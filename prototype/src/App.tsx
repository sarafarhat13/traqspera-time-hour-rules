import { useState, useEffect, useRef, useCallback, type CSSProperties, type ReactNode } from "react";
import { toast, Toaster } from "sonner";
import {
  ModusWcAlert,
  ModusWcBadge,
  ModusWcButton,
  ModusWcCheckbox,
  ModusWcIcon,
  ModusWcNumberInput,
  ModusWcPagination,
  ModusWcSelect,
  ModusWcSwitch,
  ModusWcTabs,
  ModusWcTextInput,
  ModusWcTextarea,
  ModusWcTimeInput,
} from "@trimble-oss/moduswebcomponents-react";
import {
  AlertTriangle, ChevronDown, ChevronUp, X, Check,
  GripVertical, Plus, Pencil, Info, Trash2,
  Clock, Filter, User, Users, Briefcase, CreditCard,
  BarChart2, Wrench, FileText, Settings, Shield,
  AlignJustify, ChevronRight, Bell, HelpCircle, Search, Utensils,
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
  { label: "Mon – Fri",  totalHours: 0, regHours: 8, otHours: 2, ot2Hours: 0, travelHours: 1 },
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

function NumberInput({ value, onChange, step = 0.5, min = 0, suffix, width = 88 }: {
  value: number; onChange: (v: number) => void;
  step?: number; min?: number; suffix?: string; width?: number;
}) {
  return (
    <div className="flex items-center gap-[6px]">
      <ModusWcNumberInput
        aria-label="Value"
        size="sm"
        min={min}
        step={step}
        value={String(value)}
        onInputChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
        style={{ width }}
      />
      {suffix && <span className="text-[12px] text-[#6a6e79] font-['Open_Sans',sans-serif]">{suffix}</span>}
    </div>
  );
}

function SelectField({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string;
}) {
  return (
    <ModusWcSelect
      aria-label={placeholder ?? "Select"}
      size="sm"
      value={value}
      options={placeholder ? [{ label: placeholder, value: "" }, ...options] : options}
      onInputChange={(e) => onChange(e.target.value)}
    />
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
    <ModusWcNumberInput
      aria-label="Hours allowed"
      size="sm"
      min={0}
      placeholder="—"
      value={value ? String(value) : ""}
      onInputChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      style={{ width: 96 }}
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
        alignItems: "center",
        gap: 2,
        background: "#f7f7fb",
        borderBottom: "1px solid #e0e1e9",
        padding: "10px 16px 0",
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
            className="tq-tab"
            style={{
              all: "unset",
              boxSizing: "border-box",
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: isActive ? 10 : 0,
              padding: "7px 14px",
              marginBottom: -1,
              fontFamily: "Open Sans, sans-serif",
              fontSize: 12,
              fontWeight: 600,
              lineHeight: 1.4,
              whiteSpace: "nowrap",
              cursor: "pointer",
              color: isActive ? "#0e416c" : "#6a6e79",
              background: isActive ? "#ffffff" : "transparent",
              border: isActive ? "1px solid #e0e1e9" : "1px solid transparent",
              borderBottomColor: isActive ? "#ffffff" : "transparent",
              borderRadius: "4px 4px 0 0",
              transition: "color 0.15s",
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

  const [employeeModal, setEmployeeModal] = useState<WaiverFilter | null>(null);
  const openEmployeeModal = (filter: WaiverFilter) => setEmployeeModal(filter);
  const onDutyMembers = ON_DUTY_ROSTER.filter((e) => mp.onDutyEmployees.includes(e.id));
  const onDutySigned = onDutyMembers.filter((e) => e.signedOn).length;
  const onDutyOutstanding = onDutyMembers.length - onDutySigned;

  // The meal window is only meaningful when it ends at or after it starts.
  const setMealWindow = (meal: 1 | 2, edge: "start" | "end", val: number) => {
    const startKey = meal === 1 ? "meal1Trigger" : "meal2Trigger";
    const endKey = meal === 1 ? "meal1TriggerEnd" : "meal2TriggerEnd";
    const next = { ...mp, [edge === "start" ? startKey : endKey]: val };
    if (edge === "start" && next[endKey] < val) next[endKey] = val;
    if (edge === "end" && val < next[startKey]) next[startKey] = val;
    onMealPenaltyChange(next);
  };

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

      <div style={{ padding: "16px 20px", background: "#ffffff" }}>

        {/* ── Daily Rules ── */}
        {activeTab === "daily" && (
          <>
            <div
              className="overflow-x-auto"
              style={{ border: `1px solid ${TABLE_HEADER_BORDER}`, borderRadius: 6, overflow: "hidden" }}
            >
              <table className="w-full border-collapse">
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
                  {data.days.map((day, idx) => {
                    const isLastRow = idx === data.days.length - 1;
                    return (
                      <tr key={day.label} style={{ background: idx % 2 === 0 ? "#ffffff" : "#fafafa" }}>
                        <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, fontFamily: "Open Sans, sans-serif", color: "#252a2e", whiteSpace: "nowrap", borderRight: `1px solid ${TABLE_HEADER_BORDER}`, borderBottom: isLastRow ? undefined : `1px solid ${TABLE_HEADER_BORDER}` }}>{day.label}</td>
                        {colHeaders.map((col, ci) => (
                          <td key={col.key} style={{
                            padding: "8px 8px",
                            textAlign: "center",
                            borderRight: ci < colHeaders.length - 1 ? `1px solid ${TABLE_HEADER_BORDER}` : undefined,
                            borderBottom: isLastRow ? undefined : `1px solid ${TABLE_HEADER_BORDER}`,
                          }}>
                            <CellInput value={day[col.key]} onChange={(v) => updateDay(idx, col.key, v)} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
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
              <div
                className="overflow-x-auto"
                style={{ border: `1px solid ${TABLE_HEADER_BORDER}`, borderRadius: 6, overflow: "hidden" }}
              >
                <table className="w-full border-collapse">
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
                    <tr style={{ background: "#ffffff" }}>
                      {(["weeklyTotal", "weeklyReg", "weeklyOT", "weeklyTravel"] as const).map((field, i) => (
                        <td key={field} style={{ padding: "10px 8px", textAlign: "center", borderRight: i < 3 ? `1px solid ${TABLE_HEADER_BORDER}` : undefined }}>
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
                <NumberInput value={data.breakMinHours} onChange={(v) => onChange({ ...data, breakMinHours: v })} step={0.5} min={0} suffix="hrs" />
              </div>
              <div>
                <FieldLabel>Break Length Required</FieldLabel>
                <p className="text-[11px] font-['Open_Sans',sans-serif] text-[#6a6e79] mb-[6px]">Minimum duration of the required break</p>
                <NumberInput value={data.breakLength} onChange={(v) => onChange({ ...data, breakLength: v })} step={0.25} min={0} suffix="hrs" />
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
                <NumberInput value={kioskMinHours ?? 4} onChange={onKioskMinHours ?? (() => {})} step={0.5} min={0} />
              </div>
              <div>
                <FieldLabel>Break Length Required (hours)</FieldLabel>
                <NumberInput value={kioskBreakLength ?? 0.5} onChange={onKioskBreakLength ?? (() => {})} step={0.25} min={0} />
              </div>
            </div>
          </>
        )}

        {/* ── Equipment ── */}
        {activeTab === "equipment" && showEquipment && (
          <div className="flex items-end gap-[24px]">
            <div>
              <FieldLabel>Maximum Hours Per Day</FieldLabel>
              <NumberInput value={equipMaxHours ?? 10} onChange={onEquipMaxHours ?? (() => {})} step={1} min={0} suffix="hrs" />
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
                        description="Set the window the meal must fall within, measured from shift start"
                      >
                        <div className="flex flex-wrap items-end gap-x-[20px] gap-y-[10px]">
                          <div>
                            <p className="text-[11px] font-['Open_Sans',sans-serif] text-[#464b52] mb-[4px]">Meal must begin after</p>
                            <NumberInput value={mp.meal1Trigger} onChange={(v) => setMealWindow(1, "start", v)} step={0.5} min={0} suffix="hrs into shift" />
                          </div>
                          <div>
                            <p className="text-[11px] font-['Open_Sans',sans-serif] text-[#464b52] mb-[4px]">Meal must end after</p>
                            <NumberInput value={mp.meal1TriggerEnd} onChange={(v) => setMealWindow(1, "end", v)} step={0.5} min={0} suffix="hrs into shift" />
                          </div>
                        </div>
                      </SoftOption>
                      <SoftOption
                        selected={mp.meal1Schedule === "fixed"}
                        onSelect={() => setMp("meal1Schedule", "fixed")}
                        title="Fixed schedule window"
                        description="Meal can be taken any time within a set clock-time window each day"
                      >
                        <MealWindowFields
                          start={mp.meal1WindowStart}
                          end={mp.meal1WindowEnd}
                          onStart={(v) => setMp("meal1WindowStart", v)}
                          onEnd={(v) => setMp("meal1WindowEnd", v)}
                          duration={mp.meal1Duration}
                        />
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
                    {/* Summary pill */}
                    <div className="mt-auto flex items-start gap-[8px] rounded-[6px] bg-[#f1f1f6] px-[12px] py-[10px]">
                      <div className="h-[6px] w-[6px] rounded-full bg-[#006fb0] shrink-0 mt-[4px]" />
                      <p className="text-[11px] font-['Open_Sans',sans-serif] text-[#464b52] leading-[16px]">
                        {mp.meal1Schedule === "relative"
                          ? `Meal required between ${mp.meal1Trigger} and ${mp.meal1TriggerEnd} hrs worked · min ${mp.meal1Duration} min`
                          : `Meal window ${formatClock(mp.meal1WindowStart)} – ${formatClock(mp.meal1WindowEnd)} · min ${mp.meal1Duration} min`}
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
                        description="Set the window the meal must fall within, measured from shift start"
                      >
                        <div className="flex flex-wrap items-end gap-x-[20px] gap-y-[10px]">
                          <div>
                            <p className="text-[11px] font-['Open_Sans',sans-serif] text-[#464b52] mb-[4px]">Meal must begin after</p>
                            <NumberInput value={mp.meal2Trigger} onChange={(v) => setMealWindow(2, "start", v)} step={0.5} min={0} suffix="hrs into shift" />
                          </div>
                          <div>
                            <p className="text-[11px] font-['Open_Sans',sans-serif] text-[#464b52] mb-[4px]">Meal must end after</p>
                            <NumberInput value={mp.meal2TriggerEnd} onChange={(v) => setMealWindow(2, "end", v)} step={0.5} min={0} suffix="hrs into shift" />
                          </div>
                        </div>
                      </SoftOption>
                      <SoftOption
                        selected={mp.meal2Schedule === "fixed"}
                        onSelect={() => setMp("meal2Schedule", "fixed")}
                        title="Fixed schedule window"
                        description="Meal can be taken any time within a set clock-time window each day"
                      >
                        <MealWindowFields
                          start={mp.meal2WindowStart}
                          end={mp.meal2WindowEnd}
                          onStart={(v) => setMp("meal2WindowStart", v)}
                          onEnd={(v) => setMp("meal2WindowEnd", v)}
                          duration={mp.meal2Duration}
                        />
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
                    <div className="mt-auto flex items-start gap-[8px] rounded-[6px] bg-[#f1f1f6] px-[12px] py-[10px]">
                      <div className="h-[6px] w-[6px] rounded-full bg-[#006fb0] shrink-0 mt-[4px]" />
                      <p className="text-[11px] font-['Open_Sans',sans-serif] text-[#464b52] leading-[16px]">
                        {mp.meal2Schedule === "relative"
                          ? `Meal required between ${mp.meal2Trigger} and ${mp.meal2TriggerEnd} hrs worked · min ${mp.meal2Duration} min`
                          : `Meal window ${formatClock(mp.meal2WindowStart)} – ${formatClock(mp.meal2WindowEnd)} · min ${mp.meal2Duration} min`}
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

                {/* Applies to */}
                <div className="px-[20px] pt-[16px] pb-[18px]" style={{ borderTop: "1px solid #e0e1e9" }}>
                  <SectionLabel>Assigned Employees</SectionLabel>
                  <div className="flex flex-wrap items-center justify-between gap-[12px] rounded-[6px] px-[12px] py-[10px]"
                    style={{ background: "#f7f7fb", border: "1px solid #e0e1e9" }}>
                    <div className="flex items-center gap-[8px]">
                      <Users size={14} style={{ color: "#6a6e79" }} />
                      <span className="text-[12px] font-['Open_Sans',sans-serif] text-[#252a2e]">
                        {onDutyMembers.length === 0
                          ? "No employees assigned yet"
                          : `${onDutyMembers.length} employees assigned`}
                      </span>
                      {onDutyMembers.length > 0 && (
                        <span className="text-[11px] font-['Open_Sans',sans-serif]"
                          style={{ color: onDutyOutstanding > 0 ? "#b45309" : "#15803d" }}>
                          · {onDutySigned} signed
                          {onDutyOutstanding > 0 ? `, ${onDutyOutstanding} outstanding` : ", all up to date"}
                        </span>
                      )}
                    </div>
                    <ModusWcButton color="primary" variant="outlined" size="sm"
                      onButtonClick={() => openEmployeeModal("all")}>
                      <ModusWcIcon decorative name="manage_people" size="xs" />
                      Manage employees
                    </ModusWcButton>
                  </div>
                </div>
              </div>
            </CardShell>

            {employeeModal && (
              <OnDutyEmployeeModal
                selected={mp.onDutyEmployees}
                initialFilter={employeeModal}
                onApply={(ids) => setMp("onDutyEmployees", ids)}
                onClose={() => setEmployeeModal(null)}
              />
            )}

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
                          <NumberInput value={mp.freeMealBeforeMinutes} onChange={(v) => setMp("freeMealBeforeMinutes", v)} step={1} min={1} suffix="min before" />
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
                    <ModusWcTextarea
                      aria-label="Notification message"
                      value={mp.freeMealPrompt}
                      onInputChange={(e) => setMp("freeMealPrompt", e.target.value)}
                      rows={3}
                      maxLength={200}
                      placeholder="Enter the message employees will see during their meal break..."
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
              <ModusWcButton color="danger" variant="outlined" size="sm" onButtonClick={deleteStateRules}>
                <ModusWcIcon decorative name="delete" size="xs" />
                Delete
              </ModusWcButton>
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
              <ModusWcButton color="danger" variant="outlined" size="sm" onButtonClick={deleteUnionRules}>
                <ModusWcIcon decorative name="delete" size="xs" />
                Delete
              </ModusWcButton>
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
type ExclusionItem = { id: number; label: string; subLabel?: string };

type PhaseOption = { code: string; name: string };
type JobOption = { code: string; name: string; phases: PhaseOption[] };

// Stands in for the tenant job list the picker would load from the server.
const JOB_CATALOG: JobOption[] = [
  {
    code: "003699", name: "AEP Carrollton Sub", phases: [
      { code: "5554", name: "Renewal - Asphalt" },
      { code: "5555", name: "Grading" },
      { code: "5556", name: "Base Course" },
    ],
  },
  {
    code: "003700", name: "Kettle River Crossing", phases: [
      { code: "6100", name: "Mobilization" },
      { code: "6120", name: "Pier Construction" },
      { code: "6140", name: "Deck Pour" },
    ],
  },
  {
    code: "003701", name: "Highway 12 Resurfacing", phases: [
      { code: "7010", name: "Milling" },
      { code: "7020", name: "Overlay" },
    ],
  },
];

const RATE_LEVEL_OPTIONS = ["Holiday", "Standby", "Shift Differential", "Apprentice"];

type ExclusionKind = "job" | "phase" | "rate";

// Lets a job exclusion cover the whole job rather than one phase on it.
const ALL_PHASES = "__all__";

function ExclusionPicker({ kind, existing, onClose, onAdd }: {
  kind: ExclusionKind;
  existing: ExclusionItem[];
  onClose: () => void;
  onAdd: (item: { label: string; subLabel?: string }) => void;
}) {
  const [jobCode, setJobCode] = useState(JOB_CATALOG[0].code);
  const [phaseCode, setPhaseCode] = useState(kind === "job" ? ALL_PHASES : JOB_CATALOG[0].phases[0].code);
  const [rateLevel, setRateLevel] = useState(RATE_LEVEL_OPTIONS[0]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const job = JOB_CATALOG.find(j => j.code === jobCode) ?? JOB_CATALOG[0];
  const phase = job.phases.find(p => p.code === phaseCode) ?? (kind === "phase" ? job.phases[0] : undefined);

  const draft =
    kind === "rate" ? { label: rateLevel } :
    phase           ? { label: `${job.code} · ${phase.code}`, subLabel: `${job.name} — ${phase.name}` } :
                      { label: job.code, subLabel: `${job.name} — all phases` };

  const duplicate = existing.some(item => item.label === draft.label);
  const title = kind === "job" ? "Exclude a Job" : kind === "phase" ? "Exclude a Phase" : "Exclude a Rate Level";
  const hint =
    kind === "rate" ? "Hours at the selected rate level are skipped by the rules." :
    phase           ? "Only the selected phase is excluded on this job." :
                      "Every phase on the selected job is excluded.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px]" onClick={onClose}>
      <div className="relative w-[440px] rounded-[8px] bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#e0e1e9] px-[20px] py-[14px]">
          <span className="text-[14px] font-bold font-['Open_Sans',sans-serif] text-[#252a2e]">{title}</span>
          <button onClick={onClose} className="text-[#6a6e79] hover:text-[#252a2e] transition-colors"><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-[14px] px-[20px] py-[16px]">
          {kind === "rate" ? (
            <ModusWcSelect
              label="Rate level"
              size="sm"
              value={rateLevel}
              options={RATE_LEVEL_OPTIONS.map(r => ({ label: r, value: r }))}
              onInputChange={(e) => setRateLevel(e.target.value)}
            />
          ) : (
            <>
              <ModusWcSelect
                label="Job"
                size="sm"
                value={jobCode}
                options={JOB_CATALOG.map(j => ({ label: `${j.code} - ${j.name}`, value: j.code }))}
                onInputChange={(e) => {
                  const next = e.target.value;
                  setJobCode(next);
                  // The phase list is scoped to the job, so the old pick may not exist here.
                  const nextJob = JOB_CATALOG.find(j => j.code === next);
                  if (nextJob) setPhaseCode(kind === "job" ? ALL_PHASES : nextJob.phases[0].code);
                }}
              />
              <ModusWcSelect
                label="Phase"
                size="sm"
                value={phase ? phase.code : ALL_PHASES}
                options={[
                  ...(kind === "job" ? [{ label: "All phases", value: ALL_PHASES }] : []),
                  ...job.phases.map(p => ({ label: `${p.code} - ${p.name}`, value: p.code })),
                ]}
                onInputChange={(e) => setPhaseCode(e.target.value)}
              />
            </>
          )}
          <p className="text-[11px] font-['Open_Sans',sans-serif] leading-[16px]"
            style={{ color: duplicate ? "#b45309" : "#6a6e79" }}>
            {duplicate ? "This is already on the exclusion list." : hint}
          </p>
        </div>
        <div className="flex items-center justify-end gap-[8px] border-t border-[#e0e1e9] px-[20px] py-[12px]">
          <ModusWcButton color="neutral" variant="outlined" size="sm" onButtonClick={onClose}>Cancel</ModusWcButton>
          <ModusWcButton color="primary" variant="filled" size="sm"
            disabled={duplicate} onButtonClick={() => { onAdd(draft); onClose(); }}>
            Add exclusion
          </ModusWcButton>
        </div>
      </div>
    </div>
  );
}

function ExclusionSection({ title, description, items, onDelete, onAdd }: {
  title: string; description: string;
  items: ExclusionItem[]; onDelete: (id: number) => void; onAdd: () => void;
}) {
  return (
    <div>
      <SectionDivider>{title}</SectionDivider>
      <SectionBody>
        <div className="px-[20px] py-[14px]">
          <div className="flex items-center justify-between mb-[10px]">
            <p className="text-[12px] font-['Open_Sans',sans-serif] text-[#464b52] leading-[18px]">{description}</p>
            <div className="ml-[16px] shrink-0">
              <ModusWcButton color="primary" variant="outlined" size="sm" onButtonClick={onAdd}>
                <ModusWcIcon decorative name="add" size="xs" />
                Add
              </ModusWcButton>
            </div>
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
                  <button onClick={() => onDelete(item.id)} aria-label={`Remove ${item.label}`}
                    className="flex h-[26px] w-[26px] items-center justify-center rounded-[4px] text-[#6a6e79] hover:bg-[#fbdde2] hover:text-[#ab1f26] transition-colors">
                    <Trash2 size={13} />
                  </button>
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
    { id: 1, label: "003699", subLabel: "AEP Carrollton Sub — all phases" },
  ]);
  const [phases, setPhases] = useState<ExclusionItem[]>([]);
  const [rateLevels, setRateLevels] = useState<ExclusionItem[]>([
    { id: 1, label: "Holiday" },
  ]);
  const [picker, setPicker] = useState<ExclusionKind | null>(null);

  const listFor = (kind: ExclusionKind) => kind === "job" ? jobs : kind === "phase" ? phases : rateLevels;
  const setterFor = (kind: ExclusionKind) => kind === "job" ? setJobs : kind === "phase" ? setPhases : setRateLevels;

  const addItem = (kind: ExclusionKind) => (item: { label: string; subLabel?: string }) => {
    setterFor(kind)((prev) => [...prev, { id: Date.now(), ...item }]);
    onSave();
  };

  const deleteItem = (kind: ExclusionKind) => (id: number) => {
    setterFor(kind)((prev) => prev.filter((item) => item.id !== id));
    onSave();
  };

  return (
    <div className="flex flex-col gap-[20px]">
      <ExclusionSection title="Jobs To Exclude From Rules"
        description="You may specify jobs not to be calculated in hour rules. All Phases for this job will be excluded as well."
        items={jobs} onDelete={deleteItem("job")} onAdd={() => setPicker("job")} />
      <ExclusionSection title="Phases To Exclude From Rules"
        description="You may specify a Phase combination not to be calculated in hour rules."
        items={phases} onDelete={deleteItem("phase")} onAdd={() => setPicker("phase")} />
      <ExclusionSection title="Rate Levels To Exclude From Rules"
        description="You may specify rate levels not to be calculated in hour rules."
        items={rateLevels} onDelete={deleteItem("rate")} onAdd={() => setPicker("rate")} />

      {picker && (
        <ExclusionPicker kind={picker} existing={listFor(picker)}
          onClose={() => setPicker(null)} onAdd={addItem(picker)} />
      )}
    </div>
  );
}

// ─── Meal & Penalties embedded section ───────────────────────────────────────
type OnDutyMealAction = "flag" | "pay_time_worked" | "flag_and_pay";

type OnDutyEmployee = { id: string; name: string; role: string; signedOn: string | null };

// Stands in for a paged employee lookup; a real tenant roster is far larger.
const ON_DUTY_ROSTER: OnDutyEmployee[] = [
  { id: "e01", name: "Adam Reyes",        role: "Gate Guard",         signedOn: "2026-01-14" },
  { id: "e02", name: "Priya Natarajan",   role: "Patrol Officer",     signedOn: "2026-01-14" },
  { id: "e03", name: "Marcus Webb",       role: "Night Guard",        signedOn: null },
  { id: "e04", name: "Dana Whitfield",    role: "Gate Guard",         signedOn: "2026-03-02" },
  { id: "e05", name: "Luis Ferreira",     role: "Crane Operator",     signedOn: "2026-02-09" },
  { id: "e06", name: "Grace Okonkwo",     role: "Loader Operator",    signedOn: null },
  { id: "e07", name: "Tom Halvorsen",     role: "Excavator Operator", signedOn: "2026-02-09" },
  { id: "e08", name: "Sofia Marchetti",   role: "Grader Operator",    signedOn: null },
  { id: "e09", name: "Ray Kimura",        role: "Dispatcher",         signedOn: "2025-11-20" },
  { id: "e10", name: "Elena Vasquez",     role: "Control Room Lead",  signedOn: "2025-11-20" },
  { id: "e11", name: "Jordan Pace",       role: "Dispatcher",         signedOn: null },
  { id: "e12", name: "Nadia Farouk",      role: "Site Medic",         signedOn: "2026-04-01" },
  { id: "e13", name: "Colin Barrett",     role: "Site Medic",         signedOn: "2026-04-01" },
  { id: "e14", name: "Hannah Lindqvist",  role: "Utility Tech",       signedOn: null },
  { id: "e15", name: "Devon Achebe",      role: "Utility Tech",       signedOn: "2026-05-18" },
  { id: "e16", name: "Mei Ling Chen",     role: "Site Supervisor",    signedOn: "2026-05-18" },
  { id: "e17", name: "Owen Brady",        role: "Fuel Truck Driver",  signedOn: null },
  { id: "e18", name: "Aisha Rahman",      role: "Weighbridge Clerk",  signedOn: "2026-06-02" },
];

const formatSignedDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}, ${y}`;
};

type MealPenaltyState = {
  meal1Enabled: boolean; meal1Trigger: number; meal1TriggerEnd: number; meal1Duration: number; meal1Schedule: ScheduleType;
  meal1WindowStart: string; meal1WindowEnd: string;
  meal2Enabled: boolean; meal2Trigger: number; meal2TriggerEnd: number; meal2Duration: number; meal2Schedule: ScheduleType;
  meal2WindowStart: string; meal2WindowEnd: string;
  freeMealEnabled: boolean; freeMealTrigger: FreeMealTrigger;
  freeMealMinutes: number; freeMealBeforeMinutes: number; freeMealPrompt: string;
  onDutyMealEnabled: boolean; onDutyRequireAgreement: boolean; onDutyNoAgreementAction: OnDutyMealAction;
  onDutyEmployees: string[];
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

// A window ending earlier than it starts is read as running past midnight.
const windowMinutes = (start: string, end: string): number | null => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff < 0 ? diff + 24 * 60 : diff;
};

const MealWindowFields = ({ start, end, onStart, onEnd, duration }: {
  start: string; end: string;
  onStart: (v: string) => void; onEnd: (v: string) => void;
  duration: number;
}) => {
  const span = windowMinutes(start, end);
  const tooShort = span !== null && span < duration;
  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-[12px] gap-y-[10px]">
        <ModusWcTimeInput
          label="Window opens"
          size="sm"
          value={start}
          onInputChange={(e) => onStart(e.target.value)}
        />
        <span className="text-[12px] font-['Open_Sans',sans-serif] text-[#6a6e79] pb-[9px]">to</span>
        <ModusWcTimeInput
          label="Window closes"
          size="sm"
          value={end}
          onInputChange={(e) => onEnd(e.target.value)}
        />
      </div>
      <p className="text-[11px] font-['Open_Sans',sans-serif] leading-[16px] mt-[8px]"
        style={{ color: tooShort ? "#b45309" : "#6a6e79" }}>
        {span === null
          ? "Enter a start and end time for the window."
          : tooShort
            ? `${span} min window is shorter than the ${duration} min meal.`
            : `${span} min window · employee takes their ${duration} min meal any time within it.`}
      </p>
    </div>
  );
};

// Time inputs render in the viewer's locale, so summaries echo the same 12-hour form.
const formatClock = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
};

const defaultMealPenalty = (): MealPenaltyState => ({
  meal1Enabled: true, meal1Trigger: 5, meal1TriggerEnd: 6, meal1Duration: 30, meal1Schedule: "relative", meal1WindowStart: "12:00", meal1WindowEnd: "13:00",
  meal2Enabled: true, meal2Trigger: 10, meal2TriggerEnd: 11, meal2Duration: 30, meal2Schedule: "relative", meal2WindowStart: "17:00", meal2WindowEnd: "18:00",
  freeMealEnabled: true, freeMealTrigger: "always", freeMealMinutes: 30, freeMealBeforeMinutes: 10,
  freeMealPrompt: "Was this meal provided free of charge by the employer?",
  onDutyMealEnabled: false, onDutyRequireAgreement: true, onDutyNoAgreementAction: "flag_and_pay",
  onDutyEmployees: ["e01", "e02", "e03", "e05", "e06", "e09", "e12"],
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
const SETTINGS_NAV_W  = 232;

// ─── Compliance Dashboard ─────────────────────────────────────────────────────

/*
  Break state and premiums are tracked separately: a missed break is what earns
  the premium, so an employee routinely belongs to both the "Missed" and the
  "Premiums" view. Category counts therefore overlap and do not sum to the roster.
*/
type BreakState = "upcoming" | "missed" | "late" | "compliant";
type ExceptionView = "all" | BreakState | "premium";

type BreakEmployee = {
  id: string;
  name: string;
  role: string;
  crew: string;
  supervisor: string;
  pm: string;
  job: string;
  costCenter: string;
  shiftStart: string;
  state: BreakState;
  minutesUntilBreak?: number;   // upcoming: time left in the window
  minutesPastWindow?: number;   // missed: time elapsed since the window closed
  breakTakenAt?: string;        // late / compliant: clock time the break started
  minutesOutsideWindow?: number; // late: how far outside the window it landed
  penaltyCount: number;
  penaltyAmount: number;
};

const MOCK_EMPLOYEES: BreakEmployee[] = [
  // Crew A — three of four still owe a break
  { id: "1",  name: "Marcus Rivera",  role: "Electrician", crew: "Crew A", supervisor: "Tom Blake", pm: "Alex Doyle",  job: "Job A", costCenter: "CC-100", shiftStart: "06:00", state: "upcoming",  minutesUntilBreak: 12, penaltyCount: 0, penaltyAmount: 0 },
  { id: "2",  name: "Dani Okonkwo",   role: "Foreman",     crew: "Crew A", supervisor: "Tom Blake", pm: "Alex Doyle",  job: "Job A", costCenter: "CC-100", shiftStart: "06:00", state: "upcoming",  minutesUntilBreak: 8,  penaltyCount: 0, penaltyAmount: 0 },
  { id: "3",  name: "Amy Fitzgerald", role: "Inspector",   crew: "Crew A", supervisor: "Tom Blake", pm: "Alex Doyle",  job: "Job A", costCenter: "CC-100", shiftStart: "06:00", state: "missed",    minutesPastWindow: 7,  penaltyCount: 1, penaltyAmount: 90 },
  { id: "4",  name: "Nadia Volkov",   role: "Laborer",     crew: "Crew A", supervisor: "Tom Blake", pm: "Alex Doyle",  job: "Job A", costCenter: "CC-100", shiftStart: "06:30", state: "late",      breakTakenAt: "12:52", minutesOutsideWindow: 22, penaltyCount: 1, penaltyAmount: 90 },
  // Crew B — nobody has started a break, the whole-crew intervention case
  { id: "5",  name: "Priya Nair",     role: "Laborer",     crew: "Crew B", supervisor: "Tom Blake", pm: "Renee Cole",  job: "Job B", costCenter: "CC-200", shiftStart: "06:30", state: "upcoming",  minutesUntilBreak: 22, penaltyCount: 0, penaltyAmount: 0 },
  { id: "6",  name: "Luis Ferreira",  role: "Foreman",     crew: "Crew B", supervisor: "Tom Blake", pm: "Renee Cole",  job: "Job B", costCenter: "CC-200", shiftStart: "06:30", state: "upcoming",  minutesUntilBreak: 15, penaltyCount: 0, penaltyAmount: 0 },
  { id: "7",  name: "Grace Bennett",  role: "Laborer",     crew: "Crew B", supervisor: "Tom Blake", pm: "Renee Cole",  job: "Job B", costCenter: "CC-200", shiftStart: "06:00", state: "upcoming",  minutesUntilBreak: 19, penaltyCount: 0, penaltyAmount: 0 },
  { id: "8",  name: "Linda Tran",     role: "Electrician", crew: "Crew B", supervisor: "Tom Blake", pm: "Renee Cole",  job: "Job B", costCenter: "CC-200", shiftStart: "06:00", state: "missed",    minutesPastWindow: 18, penaltyCount: 1, penaltyAmount: 90 },
  { id: "9",  name: "Sam Park",       role: "Electrician", crew: "Crew B", supervisor: "Tom Blake", pm: "Renee Cole",  job: "Job B", costCenter: "CC-200", shiftStart: "06:00", state: "missed",    minutesPastWindow: 26, penaltyCount: 2, penaltyAmount: 180 },
  // Crew C
  { id: "10", name: "Jake Morales",   role: "Foreman",     crew: "Crew C", supervisor: "Sara Chen", pm: "Alex Doyle",  job: "Job C", costCenter: "CC-200", shiftStart: "07:00", state: "upcoming",  minutesUntilBreak: 5,  penaltyCount: 0, penaltyAmount: 0 },
  { id: "11", name: "Carlos Vega",    role: "Laborer",     crew: "Crew C", supervisor: "Sara Chen", pm: "Alex Doyle",  job: "Job C", costCenter: "CC-300", shiftStart: "06:00", state: "missed",    minutesPastWindow: 34, penaltyCount: 1, penaltyAmount: 90 },
  { id: "12", name: "Tomas Ruiz",     role: "Operator",    crew: "Crew C", supervisor: "Sara Chen", pm: "Alex Doyle",  job: "Job C", costCenter: "CC-300", shiftStart: "06:00", state: "late",      breakTakenAt: "12:41", minutesOutsideWindow: 16, penaltyCount: 1, penaltyAmount: 90 },
  { id: "13", name: "Hana Suzuki",    role: "Inspector",   crew: "Crew C", supervisor: "Sara Chen", pm: "Alex Doyle",  job: "Job C", costCenter: "CC-200", shiftStart: "06:30", state: "compliant", breakTakenAt: "12:05", penaltyCount: 0, penaltyAmount: 0 },
  // Crew D
  { id: "14", name: "Devon King",     role: "Operator",    crew: "Crew D", supervisor: "Sara Chen", pm: "Renee Cole",  job: "Job B", costCenter: "CC-300", shiftStart: "05:30", state: "missed",    minutesPastWindow: 52, penaltyCount: 2, penaltyAmount: 180 },
  { id: "15", name: "Rosa Mendez",    role: "Laborer",     crew: "Crew D", supervisor: "Sara Chen", pm: "Renee Cole",  job: "Job C", costCenter: "CC-300", shiftStart: "06:00", state: "late",      breakTakenAt: "12:38", minutesOutsideWindow: 13, penaltyCount: 1, penaltyAmount: 90 },
  { id: "16", name: "Ivan Petrov",    role: "Operator",    crew: "Crew D", supervisor: "Sara Chen", pm: "Renee Cole",  job: "Job B", costCenter: "CC-300", shiftStart: "06:00", state: "compliant", breakTakenAt: "11:48", penaltyCount: 0, penaltyAmount: 0 },
  { id: "17", name: "Mia Chen",       role: "Laborer",     crew: "Crew D", supervisor: "Sara Chen", pm: "Renee Cole",  job: "Job B", costCenter: "CC-300", shiftStart: "06:00", state: "compliant", breakTakenAt: "11:52", penaltyCount: 0, penaltyAmount: 0 },
];

// Crew-level alerts go to the foreman, not to each worker individually.
const CREW_FOREMAN: Record<string, string> = {
  "Crew A": "Dani Okonkwo",
  "Crew B": "Luis Ferreira",
  "Crew C": "Jake Morales",
  "Crew D": "Devon King",
};

const STATE_STYLE: Record<BreakState, { label: string; color: string; bg: string; border: string }> = {
  upcoming:  { label: "Upcoming",  color: "#0063a3", bg: "#e8f2fa", border: "#a3cced" },
  missed:    { label: "Missed",    color: "#ab1f26", bg: "#faeaea", border: "#eeb4b7" },
  late:      { label: "Late",      color: "#a35b06", bg: "#fef3e2", border: "#f2ce8f" },
  compliant: { label: "On time",   color: "#15803d", bg: "#e8f7ed", border: "#a8dcbb" },
};

// An employee who has not clocked a break is who a foreman can still act on.
const hasNotStartedBreak = (e: BreakEmployee) => e.state === "upcoming" || e.state === "missed";

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

type CrewStat = {
  crew: string;
  foreman: string;
  size: number;
  upcoming: number;
  missed: number;
  late: number;
  notStarted: number;
  penaltyAmount: number;
};

// The wording a foreman receives, taken from the story's example message.
const crewAlertMessage = (c: CrewStat) =>
  c.notStarted === c.size
    ? "Your whole crew hasn't started their break yet, please make sure you take your break."
    : `${c.notStarted} of ${c.size} on ${c.crew} haven't started their break yet, please make sure they take their break.`;

function CrewCard({ stat, alerted, selected, onSelect, onAlert }: {
  stat: CrewStat; alerted: boolean;
  selected: boolean; onSelect: () => void; onAlert: () => void;
}) {
  const [hover, setHover] = useState(false);
  const wholeCrew = stat.notStarted > 0 && stat.notStarted === stat.size;
  const needsAction = stat.notStarted > 0;

  const chip = (label: string, count: number, s: { color: string; bg: string; border: string }) =>
    count === 0 ? null : (
      <span key={label} className="inline-flex items-center gap-[6px] text-[12px] font-semibold"
        style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 4, padding: "3px 8px", fontFamily: OS }}>
        {label} {count}
      </span>
    );

  const borderColor = selected ? "#0063a3" : wholeCrew ? "#eeb4b7" : "#e0e1e9";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Filter the dashboard to ${stat.crew}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: selected ? "#f5fafd" : "#ffffff",
        borderRadius: 8,
        border: `1px solid ${borderColor}`,
        boxShadow: selected
          ? `0 0 0 1px #0063a3, 0px 1px 1px rgba(0,0,0,0.05)`
          : hover
            ? "0px 3px 6px rgba(0,0,0,0.12)"
            : "0px 1px 1px rgba(0,0,0,0.05)",
        padding: 16,
        cursor: "pointer",
        transition: "box-shadow 0.15s ease, background 0.15s ease, border-color 0.15s ease",
      }}>
      <div className="flex items-start justify-between gap-[12px] mb-[10px]">
        <div>
          <p className="font-bold text-[15px] leading-[20px]" style={{ color: selected ? "#0e416c" : "#171c1e", fontFamily: OS, ...OS_FVS }}>{stat.crew}</p>
          <p className="text-[12px] leading-[16px]" style={{ color: "#6a6e79", fontFamily: OS, marginTop: 2 }}>
            Foreman {stat.foreman} · {stat.size} on shift
          </p>
        </div>
        {stat.penaltyAmount > 0 && (
          <span className="text-[12px] font-semibold whitespace-nowrap" style={{ color: "#a35b06", fontFamily: OS }}>
            ${stat.penaltyAmount.toFixed(2)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-[6px] mb-[12px]">
        {chip("Upcoming", stat.upcoming, STATE_STYLE.upcoming)}
        {chip("Missed", stat.missed, STATE_STYLE.missed)}
        {chip("Late", stat.late, STATE_STYLE.late)}
        {stat.upcoming + stat.missed + stat.late === 0 && (
          <span className="inline-flex items-center gap-[6px] text-[12px] font-semibold"
            style={{ background: STATE_STYLE.compliant.bg, color: STATE_STYLE.compliant.color, border: `1px solid ${STATE_STYLE.compliant.border}`, borderRadius: 4, padding: "3px 8px", fontFamily: OS }}>
            All breaks taken
          </span>
        )}
      </div>

      {wholeCrew && (
        <p className="text-[12px] font-semibold leading-[16px]" style={{ color: "#ab1f26", fontFamily: OS, marginBottom: 10 }}>
          Whole crew still hasn't started their break.
        </p>
      )}

      {needsAction ? (
        // Keep the alert action from also toggling the card's crew filter.
        <div className="inline-flex" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <ModusWcButton color="primary" variant="outlined" size="sm"
            disabled={alerted} onButtonClick={onAlert}>
            <ModusWcIcon decorative name="notifications" size="xs" />
            {alerted ? "Notified" : "Notify foreman"}
          </ModusWcButton>
        </div>
      ) : (
        <p className="text-[12px]" style={{ color: "#6a6e79", fontFamily: OS }}>No action needed.</p>
      )}

      <p className="text-[11px] leading-[15px]" style={{ color: selected ? "#0063a3" : "#a3a3a3", fontFamily: OS, marginTop: 10 }}>
        {selected ? "Filtering the dashboard by this crew — click to clear" : "Click to filter the dashboard by this crew"}
      </p>
    </div>
  );
}

function EmployeeRow({ emp, idx, selected, onToggle, alerted, onAlert }: {
  emp: BreakEmployee; idx: number;
  selected: boolean; onToggle: () => void;
  alerted: boolean; onAlert: () => void;
}) {
  const rowBg = selected ? "#e8f2fa" : idx % 2 === 0 ? "#ffffff" : "#fafafa";

  const s = STATE_STYLE[emp.state];
  const detail =
    emp.state === "upcoming"  ? `Due in ${emp.minutesUntilBreak} min` :
    emp.state === "missed"    ? `${emp.minutesPastWindow} min past window` :
    emp.state === "late"      ? `Took ${emp.breakTakenAt} · ${emp.minutesOutsideWindow} min outside` :
                                `Took ${emp.breakTakenAt}`;

  const statusNode = () => (
    <div>
      <span className="inline-flex items-center text-[12px] font-bold"
        style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 4, padding: "2px 8px", fontFamily: OS }}>
        {s.label}
      </span>
      <p className="text-[12px] leading-[16px] whitespace-nowrap" style={{ color: "#6a6e79", fontFamily: OS, ...OS_FVS, marginTop: 3 }}>
        {detail}
      </p>
    </div>
  );

  const premiumNode = () => emp.penaltyCount === 0 ? (
    <p className="text-[14px] leading-[20px]" style={{ color: "#a3a3a3", fontFamily: OS, ...OS_FVS }}>—</p>
  ) : (
    <div>
      <p className="font-semibold text-[14px] leading-[20px]" style={{ color: "#a35b06", fontFamily: OS, ...OS_FVS }}>
        ${emp.penaltyAmount.toFixed(2)}
      </p>
      <p className="text-[12px] leading-[16px] whitespace-nowrap" style={{ color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>
        {emp.penaltyCount} violation{emp.penaltyCount > 1 ? "s" : ""}
      </p>
    </div>
  );

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
        <p className="font-semibold text-[14px] leading-[20px] opacity-60 whitespace-nowrap" style={{ color: "#171c1e", fontFamily: OS, ...OS_FVS }}>{emp.pm}</p>
      </td>
      <td className="px-[16px] py-[12px]">
        <p className="font-semibold text-[14px] leading-[20px] opacity-60 whitespace-nowrap" style={{ color: "#171c1e", fontFamily: OS, ...OS_FVS }}>{emp.job}</p>
      </td>
      <td className="px-[16px] py-[12px]">
        <p className="font-semibold text-[14px] leading-[20px] opacity-60 whitespace-nowrap" style={{ color: "#171c1e", fontFamily: OS, ...OS_FVS }}>{emp.costCenter}</p>
      </td>
      <td className="px-[16px] py-[12px]">{statusNode()}</td>
      <td className="px-[16px] py-[12px]">{premiumNode()}</td>
      <td className="px-[16px] py-[12px]">
        {hasNotStartedBreak(emp) ? (
          <ModusWcButton
            color={alerted ? "secondary" : "primary"}
            variant="outlined"
            size="sm"
            disabled={alerted}
            onButtonClick={onAlert}
          >
            {alerted ? "Notified" : "Send Alert"}
          </ModusWcButton>
        ) : (
          <p className="text-[12px]" style={{ color: "#a3a3a3", fontFamily: OS }}>—</p>
        )}
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
    <div style={{ flex: "1 1 160px", minWidth: 150 }}>
      {options ? (
        <ModusWcSelect
          label={placeholder}
          size="sm"
          value={value ?? ""}
          // Modus dropped the placeholder prop; a blank first option is the clear action.
          options={[{ label: "All", value: "" }, ...options.map(o => ({ label: o, value: o }))]}
          onInputChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <ModusWcTextInput
          label={placeholder}
          type="search"
          size="sm"
          includeSearch
          includeClear
          placeholder="Name or role"
          value={value ?? ""}
          onInputChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

// ─── On-Duty Meal Employees Modal ────────────────────────────────────────────
type WaiverFilter = "all" | "assigned" | "signed" | "unsigned";

const PAGE_SIZE = 8;

// Each filter carries its own semantic color so the counts read at a glance.
const FILTER_STYLES: Record<WaiverFilter, {
  tint: string; border: string; text: string;
  badgeOn: string; badgeOnText: string; badgeOff: string; badgeOffText: string;
}> = {
  all:      { tint: "#e8f2fa", border: "#0063a3", text: "#0e416c", badgeOn: "#0063a3", badgeOnText: "#ffffff", badgeOff: "#cfe4f4", badgeOffText: "#0e416c" },
  assigned: { tint: "#fdf4e3", border: "#d99a2b", text: "#7c4a03", badgeOn: "#e0a338", badgeOnText: "#3d2600", badgeOff: "#fae7c4", badgeOffText: "#7c4a03" },
  signed:   { tint: "#e8f7ed", border: "#16a34a", text: "#15803d", badgeOn: "#16a34a", badgeOnText: "#ffffff", badgeOff: "#cbeed8", badgeOffText: "#15803d" },
  unsigned: { tint: "#fdecec", border: "#d64545", text: "#a72020", badgeOn: "#d64545", badgeOnText: "#ffffff", badgeOff: "#f9d5d5", badgeOffText: "#a72020" },
};

function OnDutyEmployeeModal({ selected, initialFilter, onApply, onClose }: {
  selected: string[];
  initialFilter: WaiverFilter;
  onApply: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<WaiverFilter>(initialFilter);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [draft, setDraft] = useState<string[]>(selected);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const outstanding = ON_DUTY_ROSTER.filter((e) => draft.includes(e.id) && !e.signedOn).length;

  const matches = ON_DUTY_ROSTER.filter((e) => {
    if (filter === "assigned" && !draft.includes(e.id)) return false;
    if (filter === "signed" && !e.signedOn) return false;
    if (filter === "unsigned" && e.signedOn) return false;
    const q = query.trim().toLowerCase();
    return !q || e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q);
  });

  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = matches.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const setFilterAndReset = (f: WaiverFilter) => { setFilter(f); setPage(0); };
  const toggle = (id: string) =>
    setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  const tabs: { value: WaiverFilter; label: string; count: number }[] = [
    { value: "all",      label: "All",        count: ON_DUTY_ROSTER.length },
    { value: "assigned", label: "Assigned",   count: draft.length },
    { value: "signed",   label: "Signed",     count: ON_DUTY_ROSTER.filter((e) => e.signedOn).length },
    { value: "unsigned", label: "Not signed", count: ON_DUTY_ROSTER.filter((e) => !e.signedOn).length },
  ];

  const th = "px-[16px] py-[10px] text-left text-[11px] font-semibold uppercase tracking-[0.4px] text-[#6a6e79]";
  const td = "px-[16px] py-[11px] text-[13px] text-[#252a2e] align-middle";

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 200, background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="On-duty meal employees"
        className="bg-white rounded-[10px] shadow-[0_8px_40px_rgba(0,0,0,0.18)] flex flex-col font-['Open_Sans',sans-serif]"
        style={{ width: 720, maxHeight: "88vh", overflow: "hidden" }}>
        {/* Header */}
        <div className="flex items-start justify-between px-[24px] py-[18px]" style={{ borderBottom: "1px solid #e0e1e9" }}>
          <div>
            <p className="text-[18px] font-semibold text-[#252a2e]">On-Duty Meal Employees</p>
            <p className="text-[12px] text-[#6a6e79] mt-[2px]">
              Choose who can record an on-duty meal and review their signed agreements.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="flex h-[32px] w-[32px] items-center justify-center rounded-full hover:bg-[#f1f1f6] transition-colors"
            style={{ background: "transparent", border: "none", cursor: "pointer" }}>
            <X size={18} style={{ color: "#6a6e79" }} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-[12px] px-[24px] py-[16px]">
          <div className="flex shrink-0 items-center gap-[8px]">
            {tabs.map((t) => {
              const s = FILTER_STYLES[t.value];
              const active = filter === t.value;
              return (
                <button key={t.value} type="button" onClick={() => setFilterAndReset(t.value)}
                  aria-pressed={active}
                  className="inline-flex items-center whitespace-nowrap transition-colors"
                  style={{
                    background: active ? s.tint : "#ffffff",
                    color: active ? s.text : "#252a2e",
                    fontWeight: active ? 700 : 400,
                    border: `1px solid ${active ? s.border : "#e0e1e9"}`,
                    borderRadius: 4,
                    cursor: "pointer",
                    padding: "4px 5px 4px 12px",
                    gap: 7,
                    fontSize: 12,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                  }}>
                  {t.label}
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    minWidth: 20, height: 20, padding: "0 6px", borderRadius: 9999,
                    background: active ? s.badgeOn : s.badgeOff,
                    color: active ? s.badgeOnText : s.badgeOffText,
                    fontSize: 11, fontWeight: 700, lineHeight: 1,
                  }}>
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ width: 220, flexShrink: 1 }}>
            <ModusWcTextInput
              aria-label="Search employees"
              type="search"
              size="sm"
              includeSearch
              includeClear
              placeholder="Search name or role"
              value={query}
              onInputChange={(e) => { setQuery(e.target.value); setPage(0); }}
              onClearClick={() => { setQuery(""); setPage(0); }}
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto px-[24px]">
          <div style={{ border: "1px solid #e0e1e9", borderRadius: 6, overflow: "hidden" }}>
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ background: "#f7f7fb" }}>
                  <th className={th} style={{ width: 44 }} aria-label="Assigned" />
                  <th className={th}>Employee</th>
                  <th className={th}>Agreement</th>
                  <th className={th} style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e, i) => {
                  const assigned = draft.includes(e.id);
                  return (
                    <tr key={e.id} style={{ borderTop: i === 0 ? "1px solid #e0e1e9" : "1px solid #eef0f3" }}>
                      <td className={td}>
                        <ModusWcCheckbox
                          aria-label={`Assign ${e.name}`}
                          size="sm"
                          value={assigned}
                          onInputChange={() => toggle(e.id)}
                        />
                      </td>
                      <td className={td}>
                        <span className="font-semibold">{e.name}</span>
                        <span className="block text-[11px] text-[#6a6e79]">{e.role}</span>
                      </td>
                      <td className={td}>
                        {e.signedOn ? (
                          <span className="inline-flex items-center gap-[6px] text-[12px] text-[#15803d]">
                            <Check size={13} /> Signed {formatSignedDate(e.signedOn)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-[6px] text-[12px] text-[#b45309]">
                            <AlertTriangle size={13} /> Not signed
                          </span>
                        )}
                      </td>
                      <td className={td} style={{ textAlign: "right" }}>
                        <button type="button"
                          onClick={() => toast.success(e.signedOn ? `Opened agreement for ${e.name}` : `Reminder sent to ${e.name}`)}
                          className="text-[12px] text-[#0063a3] hover:underline"
                          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                          {e.signedOn ? "View" : "Send reminder"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr style={{ borderTop: "1px solid #e0e1e9" }}>
                    <td colSpan={4} className="px-[16px] py-[28px] text-center text-[13px] text-[#6a6e79]">
                      No employees match this search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Paging */}
        <div className="flex items-center justify-between px-[24px] py-[12px]">
          <span className="text-[12px] text-[#6a6e79]">
            {matches.length === 0 ? "No results" : `${safePage * PAGE_SIZE + 1}–${safePage * PAGE_SIZE + rows.length} of ${matches.length}`}
          </span>
          <ModusWcPagination
            aria-label="Employee pages"
            size="sm"
            count={pageCount}
            page={safePage + 1}
            onPageChange={(e) => setPage(e.detail.newPage - 1)}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-[24px] py-[16px]" style={{ borderTop: "1px solid #e0e1e9" }}>
          <span className="text-[12px] text-[#6a6e79]">
            {draft.length} employees assigned
          </span>
          <div className="flex items-center gap-[10px]">
            {outstanding > 0 && (
              <ModusWcButton color="primary" variant="outlined" size="sm"
                onButtonClick={() => toast.success(`Reminder sent to ${outstanding} employees`)}>
                <ModusWcIcon decorative name="email" size="xs" />
                Remind all outstanding
              </ModusWcButton>
            )}
            <ModusWcButton color="primary" variant="filled" size="sm"
              onButtonClick={() => { onApply(draft); onClose(); }}>
              Save
            </ModusWcButton>
          </div>
        </div>
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
          <ModusWcSelect
            aria-label="Attestation date"
            value={dateStr}
            options={[{ label: dateStr, value: dateStr }]}
          />

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
              <ModusWcTextInput
                aria-label="Additional comments about your breaks"
                value={breakComment}
                required
                feedback={breakComment ? undefined : { level: "error", message: "A comment is required." }}
                onInputChange={(e) => setBreakComment(e.target.value)}
              />
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
              <ModusWcTextInput
                aria-label="Additional comments about injuries"
                value={hurtComment}
                onInputChange={(e) => setHurtComment(e.target.value)}
              />
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
                  className="flex flex-col items-center justify-center rounded-[8px] transition-all"
                  style={{
                    width: 56, height: 64, cursor: "pointer",
                    background: done ? "#e8f5e9" : "#ffffff",
                    border: `1px solid ${done ? "#2e7d32" : "#fbad26"}`,
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

/*
  An on-duty meal is its own state rather than a flavour of break: the employee
  eats without leaving the job, stays clocked in, and is paid for the time,
  which is what the signed on-duty meal agreement covers.
*/
type ClockState = "out" | "in" | "break" | "meal";

const ON_DUTY_AGREEMENT_SIGNED = "Feb 9, 2026";

function ClockDisplay({ elapsed, clocked }: { elapsed: number; clocked: ClockState }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const h = Math.floor(elapsed / 3600).toString().padStart(2, "0");
  const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, "0");
  const s = (elapsed % 60).toString().padStart(2, "0");
  const timeStr = `${h}:${m}:${s}`;

  const statusColor = clocked === "break" ? "#d97706" : clocked === "meal" ? "#15803d" : clocked === "in" ? "#10b981" : "#6a6e79";
  const statusLabel = clocked === "break" ? "On Break" : clocked === "meal" ? "On-Duty Meal · Paid" : clocked === "in" ? "On the Clock" : "Not Clocked In";

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
  const [clocked, setClocked] = useState<ClockState>("out");
  const [elapsed, setElapsed] = useState(0);
  const [breakElapsed, setBreakElapsed] = useState(0);
  const [mealElapsed, setMealElapsed] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [breakStart, setBreakStart] = useState<Date | null>(null);
  const [mealStart, setMealStart] = useState<Date | null>(null);
  const [mealRows, setMealRows] = useState<{ start: string; end: string | null }[]>([]);
  const [showMealModal, setShowMealModal] = useState(false);
  const [mealAck, setMealAck] = useState(false);
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
      // An on-duty meal is paid time, so the shift clock keeps running through it.
      if ((clocked === "in" || clocked === "meal") && startTime) setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
      if (clocked === "break" && breakStart) setBreakElapsed(Math.floor((Date.now() - breakStart.getTime()) / 1000));
      if (clocked === "meal" && mealStart) setMealElapsed(Math.floor((Date.now() - mealStart.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [clocked, startTime, breakStart, mealStart]);



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
  const stateColor = clocked === "out" ? "#0063a3" : clocked === "break" ? "#d97706" : clocked === "meal" ? "#15803d" : "#ab1f26";
  const stateColorLight = clocked === "out" ? "rgba(0,99,163,0.15)" : clocked === "break" ? "rgba(215,119,6,0.15)" : clocked === "meal" ? "rgba(21,128,61,0.15)" : "rgba(171,31,38,0.15)";
  const stateColorMid   = clocked === "out" ? "rgba(0,99,163,0.28)" : clocked === "break" ? "rgba(215,119,6,0.28)" : clocked === "meal" ? "rgba(21,128,61,0.28)" : "rgba(171,31,38,0.28)";
  const stateColorStrong= clocked === "out" ? "rgba(0,99,163,0.50)" : clocked === "break" ? "rgba(215,119,6,0.50)" : clocked === "meal" ? "rgba(21,128,61,0.50)" : "rgba(171,31,38,0.50)";
  const btnLabel = clocked === "out" ? "CLOCK IN" : clocked === "break" ? "END BREAK" : clocked === "meal" ? "END MEAL" : "CLOCK OUT";

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
    } else if (clocked === "meal") {
      endOnDutyMeal();
    } else {
      if (breakElapsed < MANDATORY_BREAK) {
        setShowEarlyBreakModal(true);
      } else {
        confirmEndBreak();
      }
    }
  };

  const startOnDutyMeal = () => {
    const t = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setClocked("meal"); setMealStart(new Date()); setMealElapsed(0);
    setShowMealModal(false); setMealAck(false); setShowBreakAlert(false);
    setTimeline(prev => [{ time: t, label: "On-Duty Meal Started", sub: "Staying on the clock", color: "#15803d" }, ...prev]);
    setMealRows(prev => [...prev, { start: t, end: null }]);
  };

  const endOnDutyMeal = () => {
    const t = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setClocked("in"); setMealStart(null);
    setTimeline(prev => [{ time: t, label: "On-Duty Meal Ended", sub: `After ${fmt(mealElapsed)} · paid`, color: "#0063a3" }, ...prev]);
    setMealRows(prev => prev.map((r, i) => i === prev.length - 1 && r.end === null ? { ...r, end: t } : r));
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
    <ModusWcSelect
      label={label}
      size="sm"
      value={value}
      options={options.map(o => ({ label: o, value: o }))}
      onInputChange={(e) => onChange(e.target.value)}
    />
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
          <div className="bg-white rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.18)] p-[32px]" style={{ width: 480, maxWidth: "90vw" }}>
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
            <div className="flex justify-end gap-[12px]">
              <ModusWcButton color="primary" variant="outlined" size="md"
                onButtonClick={() => setShowEarlyBreakModal(false)}>
                Wait — Stay on Break
              </ModusWcButton>
              <ModusWcButton color="primary" variant="filled" size="md"
                onButtonClick={confirmEndBreak}>
                Confirm Early Clock In
              </ModusWcButton>
            </div>
          </div>
        </div>
      )}

      {/* On-duty meal confirmation */}
      {showMealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setShowMealModal(false)}>
          <div className="bg-white rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.18)] p-[32px]"
            style={{ width: 440, maxWidth: "90vw" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-[12px] mb-[16px]">
              <div className="flex h-[40px] w-[40px] items-center justify-center rounded-full shrink-0" style={{ background: "#e8f7ed" }}>
                <Utensils size={20} style={{ color: "#15803d" }} />
              </div>
              <p style={{ fontSize: 17, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>Start On-Duty Meal</p>
            </div>

            <p style={{ fontSize: 13, color: "#464b52", fontFamily: OS, ...OS_FVS, lineHeight: 1.6, marginBottom: 16 }}>
              You stay clocked in and paid for this meal. Take it at your post when the
              job can't be left unattended. If you can step away, take a regular unpaid
              break instead.
            </p>

            <div className="flex items-center gap-[8px] px-[12px] py-[10px] rounded-[8px] mb-[20px]"
              style={{ background: "#e8f7ed", border: "1px solid #bbe6ca" }}>
              <Check size={16} strokeWidth={3} style={{ color: "#15803d", flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: "#15803d", fontFamily: OS, ...OS_FVS }}>
                On-duty meal agreement signed {ON_DUTY_AGREEMENT_SIGNED}
              </p>
            </div>

            <div style={{ marginBottom: 24 }}>
              <ModusWcCheckbox
                aria-label="I agree to take my meal on duty today."
                label="I agree to take my meal on duty today."
                value={mealAck}
                onInputChange={() => setMealAck(v => !v)}
              />
            </div>

            <div className="flex justify-end gap-[12px]">
              <ModusWcButton color="primary" variant="outlined" size="md"
                onButtonClick={() => setShowMealModal(false)}>
                Cancel
              </ModusWcButton>
              <ModusWcButton color="success" variant="filled" size="md"
                disabled={!mealAck} onButtonClick={startOnDutyMeal}>
                Start On-Duty Meal
              </ModusWcButton>
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
              <div className="shrink-0">
                <ModusWcButton color="warning" variant="filled" size="sm" onButtonClick={handleBreak}>
                  Take Break
                </ModusWcButton>
              </div>
            </div>
          )}

          {clocked === "meal" && (
            <div className="w-full flex items-center gap-[12px] mb-[24px] px-[16px] py-[12px] rounded-[8px]"
              style={{ background: "#e8f7ed", border: "1px solid #bbe6ca", maxWidth: 420 }}>
              <Utensils size={18} style={{ color: "#15803d", flexShrink: 0 }} />
              <div className="flex-1">
                <p style={{ fontSize: 13, fontWeight: 700, color: "#15803d", fontFamily: OS, ...OS_FVS }}>On-Duty Meal · {fmt(mealElapsed)}</p>
                <p style={{ fontSize: 12, color: "#3f7d55", fontFamily: OS, ...OS_FVS }}>
                  You're still on the clock and being paid for this time.
                </p>
              </div>
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
              <button type="button" onClick={() => { setMealAck(false); setShowMealModal(true); }}
                className="flex flex-col items-center gap-[6px]"
                style={{ background: "transparent", border: "none", cursor: "pointer" }}>
                <div className="flex h-[48px] w-[48px] items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
                  <Utensils size={20} style={{ color: "#464b52" }} />
                </div>
                <p style={{ fontSize: 11, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>On-Duty Meal</p>
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
                <ModusWcNumberInput
                  label="Travel"
                  size="sm"
                  min={0}
                  step={0.25}
                  value={travel}
                  onInputChange={(e) => setTravel(e.target.value)}
                />
                <ModusWcNumberInput
                  label="Quantity"
                  size="sm"
                  min={0}
                  value={qty}
                  onInputChange={(e) => setQty(e.target.value)}
                />
                <div style={{ alignSelf: "center" }}>
                  <ModusWcCheckbox
                    aria-label="Per Diem"
                    label="Per Diem"
                    size="sm"
                    value={perDiem}
                    onInputChange={() => setPerDiem(v => !v)}
                  />
                </div>
                <div className="col-span-2">
                  <ModusWcTextInput
                    label="Comment"
                    size="sm"
                    value={comment}
                    placeholder="Optional note..."
                    onInputChange={(e) => setComment(e.target.value)}
                  />
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
                  {mealRows.map((mr, i) => (
                    <tr key={`meal-${i}`} style={{ background: "#f2fbf5", borderBottom: "1px solid #bbe6ca" }}>
                      <td className="px-[10px] py-[8px]"><p style={{ fontSize: 12, color: "#15803d", fontFamily: OS, ...OS_FVS, whiteSpace: "nowrap" }}>
                        {now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </p></td>
                      <td className="px-[10px] py-[8px]"><p style={{ fontSize: 12, color: "#15803d", fontFamily: OS, ...OS_FVS }}>—</p></td>
                      <td className="px-[10px] py-[8px]"><p style={{ fontSize: 12, color: "#15803d", fontFamily: OS, ...OS_FVS, whiteSpace: "nowrap" }}>{mr.start}</p></td>
                      <td className="px-[10px] py-[8px]"><p style={{ fontSize: 12, color: "#15803d", fontFamily: OS, ...OS_FVS, whiteSpace: "nowrap" }}>{mr.end ?? "—"}</p></td>
                      <td className="px-[10px] py-[8px]"><p style={{ fontSize: 12, color: "#15803d", fontFamily: OS, ...OS_FVS }}>—</p></td>
                      <td className="px-[10px] py-[8px]"><p style={{ fontSize: 12, color: "#15803d", fontFamily: OS, ...OS_FVS }}>—</p></td>
                      <td colSpan={8} className="px-[10px] py-[8px]">
                        <div className="flex items-center gap-[8px]">
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#15803d", background: "#cdecd8", borderRadius: 4, padding: "2px 6px", fontFamily: OS, whiteSpace: "nowrap" }}>On-duty meal</span>
                          <span style={{ fontSize: 12, color: "#3f7d55", fontFamily: OS, ...OS_FVS, whiteSpace: "nowrap" }}>Paid — counts toward hours</span>
                        </div>
                      </td>
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
                {clocked === "out" ? "Not active yet!" : clocked === "break" ? "On Break" : clocked === "meal" ? "On-Duty Meal" : "On the Clock"}
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
          {clocked === "meal" && (
            <div className="flex items-center justify-between py-[16px]" style={{ borderBottom: "1px solid #e0e1e9", background: "#f2fbf5" }}>
              <div>
                <p style={{ fontSize: 13, color: "#15803d", fontFamily: OS, ...OS_FVS }}>Meal Duration</p>
                <p style={{ fontSize: 11, color: "#3f7d55", fontFamily: OS, ...OS_FVS }}>Paid — counts toward hours</p>
              </div>
              <p style={{ fontSize: 18, fontWeight: 700, color: "#15803d", fontFamily: OS, ...OS_FVS, letterSpacing: "-0.5px" }}>{fmt(mealElapsed)}</p>
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
  const [activeSection, setActiveSection] = useState<ExceptionView>("all");
  const [alertedCrews, setAlertedCrews] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [alertedIds, setAlertedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterCrew, setFilterCrew] = useState("");
  const [filterJob, setFilterJob] = useState("");
  const [filterCostCenter, setFilterCostCenter] = useState("");
  const [filterSupervisor, setFilterSupervisor] = useState("");
  const [filterPm, setFilterPm] = useState("");

  const uniqueEmployees   = [...new Set(MOCK_EMPLOYEES.map(e => e.name))];
  const uniqueCrews       = [...new Set(MOCK_EMPLOYEES.map(e => e.crew))];
  const uniqueSupervisors = [...new Set(MOCK_EMPLOYEES.map(e => e.supervisor))];
  const uniquePms         = [...new Set(MOCK_EMPLOYEES.map(e => e.pm))];
  const uniqueJobs        = [...new Set(MOCK_EMPLOYEES.map(e => e.job))];
  const uniqueCostCenters = [...new Set(MOCK_EMPLOYEES.map(e => e.costCenter))];

  const hasFilter = search || filterEmployee || filterCrew || filterJob || filterCostCenter || filterSupervisor || filterPm;

  // Filters apply first so every count on the page reflects the same slice.
  const matchesFilters = (e: BreakEmployee, ignoreCrew = false) => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.role.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterEmployee   && e.name       !== filterEmployee)   return false;
    if (!ignoreCrew && filterCrew && e.crew !== filterCrew)    return false;
    if (filterSupervisor && e.supervisor !== filterSupervisor) return false;
    if (filterPm         && e.pm         !== filterPm)         return false;
    if (filterJob        && e.job        !== filterJob)        return false;
    if (filterCostCenter && e.costCenter !== filterCostCenter) return false;
    return true;
  };

  const inScope = MOCK_EMPLOYEES.filter(e => matchesFilters(e));
  // Cards ignore the crew filter itself, so picking a crew never hides the others.
  const crewScope = MOCK_EMPLOYEES.filter(e => matchesFilters(e, true));

  const upcoming = inScope.filter(e => e.state === "upcoming");
  const missed   = inScope.filter(e => e.state === "missed");
  const lateTake = inScope.filter(e => e.state === "late");
  const premium  = inScope.filter(e => e.penaltyCount > 0);

  const displayed =
    activeSection === "upcoming" ? upcoming :
    activeSection === "missed"   ? missed :
    activeSection === "late"     ? lateTake :
    activeSection === "premium"  ? premium :
    inScope;

  const crewStats: CrewStat[] = [...new Set(crewScope.map(e => e.crew))].sort().map(crew => {
    const members = crewScope.filter(e => e.crew === crew);
    return {
      crew,
      foreman: CREW_FOREMAN[crew] ?? "Unassigned",
      size: members.length,
      upcoming: members.filter(e => e.state === "upcoming").length,
      missed:   members.filter(e => e.state === "missed").length,
      late:     members.filter(e => e.state === "late").length,
      notStarted: members.filter(hasNotStartedBreak).length,
      penaltyAmount: members.reduce((s, e) => s + e.penaltyAmount, 0),
    };
  });

  const totalPenalty = premium.reduce((s, e) => s + e.penaltyAmount, 0);
  const totalViolations = premium.reduce((s, e) => s + e.penaltyCount, 0);

  const notifyCrew = (stat: CrewStat) => {
    setAlertedCrews(prev => new Set([...prev, stat.crew]));
    toast.success(`Alert sent to ${stat.foreman} — ${stat.crew}`, { description: crewAlertMessage(stat) });
  };

  const SummaryCard = ({ label, count, sub, tone, section }: {
    label: string; count: number; sub: string;
    tone: { color: string; bg: string }; section: ExceptionView;
  }) => {
    const active = activeSection === section;
    return (
      <button onClick={() => setActiveSection(active ? "all" : section)}
        className="text-left transition-all w-full"
        style={{
          background: active ? tone.bg : "#ffffff",
          borderRadius: 8,
          boxShadow: active
            ? `0 0 0 2px ${tone.color}, 0px 1px 1px rgba(0,0,0,0.05)`
            : "0px 1px 1px rgba(0,0,0,0.05)",
          padding: 20,
          border: "none",
          cursor: "pointer",
        }}>
        <p className="font-semibold text-[14px] leading-[20px]" style={{ color: "#6a6e79", fontFamily: OS, ...OS_FVS, marginBottom: 10 }}>{label}</p>
        <h2 className="font-bold leading-[1]" style={{ color: tone.color, fontFamily: OS, ...OS_FVS, fontSize: 34, fontWeight: 700 }}>{count}</h2>
        <p className="font-semibold text-[12px] leading-[16px]" style={{ color: "#6a6e79", fontFamily: OS, ...OS_FVS, marginTop: 6 }}>{sub}</p>
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
      <div className="grid grid-cols-4 gap-[16px] mb-[8px]">
        <SummaryCard label="Upcoming Break" count={upcoming.length} sub="No break taken yet, still in window"
          tone={{ color: STATE_STYLE.upcoming.color, bg: STATE_STYLE.upcoming.bg }} section="upcoming" />
        <SummaryCard label="Missed Break" count={missed.length} sub="Past the window, no break taken"
          tone={{ color: STATE_STYLE.missed.color, bg: STATE_STYLE.missed.bg }} section="missed" />
        <SummaryCard label="Late Break" count={lateTake.length} sub="Break taken outside the window"
          tone={{ color: STATE_STYLE.late.color, bg: STATE_STYLE.late.bg }} section="late" />
        <SummaryCard label="Meal Premiums Incurred" count={totalViolations} sub={`$${totalPenalty.toFixed(2)} across ${premium.length} employees`}
          tone={{ color: "#a35b06", bg: "#fef3e2" }} section="premium" />
      </div>
      <p className="text-[12px]" style={{ color: "#6a6e79", fontFamily: OS, marginBottom: 24 }}>
        A missed or late break earns a premium, so an employee can appear in more than one category.
      </p>

      {/* Crew status — direct intervention */}
      <div className="mb-[10px] flex items-baseline justify-between">
        <p className="font-semibold text-[18px] tracking-[0.027px] leading-[27px]" style={{ color: "#000000", fontFamily: OS, ...OS_FVS }}>
          Crew Status
        </p>
        <p className="text-[12px]" style={{ color: "#6a6e79", fontFamily: OS }}>
          Alert the foreman when a crew is running behind
        </p>
      </div>
      <div className="grid grid-cols-4 gap-[16px] mb-[24px]">
        {crewStats.length === 0 ? (
          <p className="text-[14px]" style={{ color: "#6a6e79", fontFamily: OS }}>No crews match these filters.</p>
        ) : crewStats.map(stat => (
          <CrewCard key={stat.crew} stat={stat}
            alerted={alertedCrews.has(stat.crew)}
            selected={filterCrew === stat.crew}
            onSelect={() => setFilterCrew(filterCrew === stat.crew ? "" : stat.crew)}
            onAlert={() => notifyCrew(stat)} />
        ))}
      </div>

      {/* Filter matrix */}
      <div className="mb-[16px]" style={{ background: "#ffffff", borderRadius: 8, boxShadow: "0px 1px 1px rgba(0,0,0,0.05)", padding: 16 }}>
        <div className="mb-[10px] flex items-center justify-between">
          <p className="font-semibold text-[14px] leading-[20px]" style={{ color: "#464b52", fontFamily: OS, ...OS_FVS }}>Filters</p>
          {hasFilter && (
            <ModusWcButton color="primary" variant="borderless" size="sm"
              onButtonClick={() => { setSearch(""); setFilterEmployee(""); setFilterCrew(""); setFilterSupervisor(""); setFilterPm(""); setFilterJob(""); setFilterCostCenter(""); }}>
              Clear filters
            </ModusWcButton>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-[8px]">
          <FilterInput placeholder="Search" value={search} onChange={setSearch} />
          <FilterInput placeholder="Employee" value={filterEmployee} onChange={setFilterEmployee} options={uniqueEmployees} />
          <FilterInput placeholder="Crew" value={filterCrew} onChange={setFilterCrew} options={uniqueCrews} />
          <FilterInput placeholder="Supervisor" value={filterSupervisor} onChange={setFilterSupervisor} options={uniqueSupervisors} />
          <FilterInput placeholder="PM" value={filterPm} onChange={setFilterPm} options={uniquePms} />
          <FilterInput placeholder="Job" value={filterJob} onChange={setFilterJob} options={uniqueJobs} />
          <FilterInput placeholder="Cost Center" value={filterCostCenter} onChange={setFilterCostCenter} options={uniqueCostCenters} />
        </div>
      </div>

      {/* Main table — Traqspera table style */}
      <div style={{ background: "#ffffff", borderRadius: 8, boxShadow: "0px 1px 1px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        {/* Toolbar */}
        <div className="flex items-center gap-[12px] px-[16px] py-[10px] border-b" style={{ borderColor: "#0d3560", background: "#0e416c", minHeight: 48 }}>
          {activeSection !== "all" && (
            <AlertBadge
              label={
                activeSection === "upcoming" ? "Upcoming Break" :
                activeSection === "missed"   ? "Missed Break" :
                activeSection === "late"     ? "Late Break" :
                activeSection === "premium"  ? "Meal Premiums Incurred" : "On time"
              }
              color={
                activeSection === "upcoming" ? "#7ec8f7" :
                activeSection === "missed"   ? "#f7a0a5" :
                activeSection === "late"     ? "#fcd99a" : "#fcd99a"
              }
            />
          )}
          <p className="font-semibold text-[12px]" style={{ color: "#b0b7c3", fontFamily: OS, ...OS_FVS }}>
            {displayed.length} employee{displayed.length !== 1 ? "s" : ""}
          </p>
          <div className="ml-auto flex items-center gap-[12px]">
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
            <ModusWcButton color="primary" variant="filled" size="sm"
              disabled={selectedIds.size === 0}
              onButtonClick={() => {
                if (selectedIds.size === 0) return;
                setAlertedIds(prev => new Set([...prev, ...selectedIds]));
                toast.success(`Alert sent to ${selectedIds.size} employee${selectedIds.size > 1 ? "s" : ""}`);
                setSelectedIds(new Set());
              }}>
              Send Alert{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </ModusWcButton>
          </div>
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
              {["Employee", "Crew", "Supervisor", "PM", "Job", "Cost Center", "Break Status", "Premiums", "Action"].map(h => (
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
                <td colSpan={10} className="px-[16px] py-[32px] text-center">
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
  const [tenant, setTenant] = useState("enterprise");
  const [viewingAs, setViewingAs] = useState("admin");
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
      <ModusWcSelect
        aria-label="Tenant"
        size="sm"
        value={tenant}
        options={[
          { label: "Enterprise", value: "enterprise" },
          { label: "Northwest Division", value: "northwest" },
          { label: "Gulf Coast Division", value: "gulf" },
        ]}
        onInputChange={(e) => setTenant(e.target.value)}
        style={{ width: 180 }}
      />
      {/* Right: viewing + icons */}
      <div className="ml-auto flex items-center gap-[6px]">
        <ModusWcSelect
          aria-label="Viewing as"
          size="sm"
          value={viewingAs}
          options={[
            { label: "Viewing as Admin", value: "admin" },
            { label: "Viewing as Supervisor", value: "supervisor" },
            { label: "Viewing as Foreman", value: "foreman" },
            { label: "Viewing as Payroll Officer", value: "payroll" },
          ]}
          onInputChange={(e) => setViewingAs(e.target.value)}
          style={{ width: 200 }}
        />
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
  { key: "s_settings",       label: "Settings",               icon: <Settings size={17} /> },
  { key: "s_permissions",    label: "Permissions",            icon: <Shield size={17} /> },
  { key: "s_time_off_setup", label: "Time Off Setup",         icon: <Clock size={17} /> },
  { key: "s_notifications",  label: "Notifications",          icon: <AlignJustify size={17} /> },
  { key: "s_tenant_images",  label: "Tenant Images",          icon: <FileText size={17} /> },
  { key: "s_hour_rules",     label: "Hour Rules",             icon: <Filter size={17} /> },
  { key: "s_rate_level",     label: "Rate Level",             icon: <BarChart2 size={17} /> },
  { key: "s_auto_job",       label: "Automatic Job Settings", icon: <Wrench size={17} /> },
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
        <div className="px-[12px] py-[12px] border-b border-[#f0f0f4]">
          <ModusWcTextInput
            aria-label="Search navigation"
            type="search"
            placeholder="Search"
            includeSearch
            includeClear
            value={search}
            customClass="tq-nav-search"
            onInputChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {/* Items */}
        <div className="flex-1 overflow-y-auto py-[6px]" style={{ scrollbarWidth: "none" }}>
          {filtered.map((item) => {
            const active = activePage === item.key;
            return (
              <button key={item.key} onClick={() => onNavigate(item.key)}
                className="flex w-full items-start gap-[12px] transition-colors text-left"
                style={{
                  padding: "11px 12px 11px 16px",
                  background: active ? "#dcedf9" : "transparent",
                  borderLeft: active ? "4px solid #0d3560" : "4px solid transparent",
                }}>
                <span style={{ color: active ? "#0063a3" : "#464b52" }} className="shrink-0 mt-[1px]">{item.icon}</span>
                <span className="text-[14px] leading-[19px] font-['Open_Sans',sans-serif]"
                  style={{ color: active ? "#0063a3" : "#252a2e", fontWeight: active ? 600 : 400 }}>
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
