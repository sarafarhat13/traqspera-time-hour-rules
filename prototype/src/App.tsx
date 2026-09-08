import { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { toast, Toaster } from "sonner";
import {
  ModusWcAlert,
  ModusWcAutocomplete,
  ModusWcBadge,
  ModusWcButton,
  ModusWcCheckbox,
  ModusWcIcon,
  ModusWcNumberInput,
  ModusWcPagination,
  ModusWcRadio,
  ModusWcSelect,
  ModusWcSwitch,
  ModusWcTabs,
  ModusWcTextInput,
  ModusWcTextarea,
  ModusWcTimeInput,
  ModusWcTooltip,
} from "@trimble-oss/moduswebcomponents-react";
import {
  AlertTriangle, ChevronDown, ChevronUp, X, Check,
  GripVertical, Plus, Pencil, Info, Trash2,
  Clock, Filter, User, Users, Briefcase, CreditCard,
  BarChart2, Wrench, FileText, Settings, Shield,
  AlignJustify, ChevronRight, Bell, HelpCircle, Search, Utensils, Coffee,
  MapPin, LoaderCircle, Calendar, ClipboardList, Save, Paperclip,
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
function readInputString(e: CustomEvent): string {
  return String((e as CustomEvent<{ target?: { value?: string } }>).detail?.target?.value ?? "");
}

function readInputChecked(e: CustomEvent): boolean {
  return Boolean((e as CustomEvent<{ target?: { checked?: boolean } }>).detail?.target?.checked);
}

function Toggle({ enabled, onChange, ariaLabel, disabled = false }: {
  enabled: boolean; onChange: (v: boolean) => void; ariaLabel?: string; disabled?: boolean;
}) {
  return (
    <ModusWcSwitch
      aria-label={ariaLabel ?? (enabled ? "Enabled" : "Disabled")}
      size="sm"
      value={enabled}
      disabled={disabled}
      onInputChange={(e) => {
        if (disabled) return;
        onChange(readInputChecked(e as CustomEvent));
      }}
    />
  );
}

function SectionEnableToggle({ enabled, onChange, label }: {
  enabled: boolean; onChange: (v: boolean) => void; label?: string;
}) {
  return (
    <div className="flex items-center gap-[8px]">
      {label && <span className="text-[12px] text-[#464b52]">{label}</span>}
      <span
        className="text-[12px] font-semibold"
        style={{ fontFamily: OS, color: enabled ? "#464b52" : "#6a6e79" }}
      >
        {enabled ? "Enabled" : "Disabled"}
      </span>
      <Toggle
        enabled={enabled}
        onChange={onChange}
        ariaLabel={enabled ? "Disable section" : "Enable section"}
      />
    </div>
  );
}

function SectionFieldset({ enabled, children, className = "" }: {
  enabled: boolean; children: ReactNode; className?: string;
}) {
  return (
    <fieldset
      disabled={!enabled}
      className={`border-0 p-0 m-0 min-w-0 transition-opacity duration-200 ${enabled ? "" : "opacity-50"} ${className}`}
    >
      {children}
    </fieldset>
  );
}

function NumberInput({ value, onChange, step = 0.5, min = 0, suffix, width = 88, disabled = false }: {
  value: number; onChange: (v: number) => void;
  step?: number; min?: number; suffix?: string; width?: number; disabled?: boolean;
}) {
  return (
    <div className={`flex items-center gap-[6px] ${disabled ? "opacity-60 pointer-events-none select-none" : ""}`}>
      <ModusWcNumberInput
        key={disabled ? "disabled" : "enabled"}
        aria-label="Value"
        size="sm"
        min={min}
        step={step}
        value={String(value)}
        disabled={disabled}
        customClass={disabled ? "pointer-events-none" : ""}
        onInputChange={(e) => {
          if (disabled) return;
          const v = parseFloat(readInputString(e as CustomEvent));
          if (!isNaN(v)) onChange(v);
        }}
        style={{ width }}
      />
      {suffix && (
        <span className="text-[12px]" style={{ color: disabled ? "#a3a3a3" : "#6a6e79" }}>{suffix}</span>
      )}
    </div>
  );
}

function SelectField({ value, onChange, options, placeholder, disabled, customClass }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string; disabled?: boolean;
  customClass?: string;
}) {
  return (
    <ModusWcSelect
      aria-label={placeholder ?? "Select"}
      size="sm"
      value={value}
      disabled={disabled}
      customClass={customClass}
      options={placeholder ? [{ label: placeholder, value: "" }, ...options] : options}
      onInputChange={(e) => {
        if (disabled) return;
        onChange(readInputString(e as CustomEvent));
      }}
    />
  );
}

function SearchableSelectField({ value, onChange, options, placeholder, disabled, customClass }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string; disabled?: boolean;
  customClass?: string;
}) {
  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";
  const [query, setQuery] = useState(selectedLabel);

  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel, value]);

  const items = useMemo(
    () =>
      options.map((o) => ({
        label: o.label,
        value: o.value,
        visibleInMenu: true,
        selected: o.value === value,
      })),
    [options, value],
  );

  return (
    <ModusWcAutocomplete
      aria-label={placeholder ?? "Select"}
      size="sm"
      value={query}
      disabled={disabled}
      customClass={customClass}
      placeholder={placeholder}
      items={items}
      includeSearch
      minChars={0}
      showMenuOnFocus
      debounceMs={0}
      onItemSelect={(e: CustomEvent<{ value?: string; label?: string }>) => {
        if (disabled) return;
        const item = e.detail;
        if (!item?.value) return;
        onChange(item.value);
        setQuery(item.label ?? "");
      }}
      onInputChange={(e) => {
        if (disabled) return;
        setQuery(readInputString(e as CustomEvent));
      }}
      onInputBlur={() => {
        setQuery(selectedLabel);
      }}
    />
  );
}

function Checkbox({ checked, onChange, label, disabled = false }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean;
}) {
  return (
    <ModusWcCheckbox
      aria-label={label}
      label={label}
      size="sm"
      value={checked}
      disabled={disabled}
      onInputChange={(e) => {
        if (disabled) return;
        onChange(readInputChecked(e as CustomEvent));
      }}
    />
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="text-[12px] font-semibold text-[#252a2e] mb-[4px]">{children}</p>;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold text-[#6a6e79] uppercase tracking-[0.08em] mb-[8px]">{children}</p>;
}

// Blue section divider header (matches screenshot navy bars)
function SectionDivider({ children }: { children: ReactNode }) {
  return (
    <div className="bg-[#0e416c] px-[20px] py-[10px] rounded-t-[6px]">
      <h2 className="text-[13px] font-bold text-white">{children}</h2>
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
        <span className="text-[12px] font-bold text-[#464b52] uppercase tracking-[0.06em]">{title}</span>
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
              fontFamily: "var(--modus-wc-font-family), sans-serif",
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
type RuleSetTab = "daily" | "weekly" | "breaks" | "onDuty" | "kiosk" | "equipment";
type BreakType = "automatic" | "flagged" | "premium";

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
  onOpenAttestationQuestions,
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
  onOpenAttestationQuestions?: () => void;
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

  const updateViolation = (id: string, patch: Partial<ViolationRule>) => {
    const next = (mp.violations ?? defaultViolations()).map((r) =>
      r.id === id ? withViolationDefaults({ ...withViolationDefaults(r), ...patch }) : withViolationDefaults(r),
    );
    setMp("violations", next);
  };

  const configuredViolations = () => (mp.violations ?? defaultViolations()).map(withViolationDefaults);
  const breakViolationRules = () => configuredViolations().filter((v) => BREAK_VIOLATION_RULE_IDS.has(v.id));
  const mealViolationRules = () => configuredViolations().filter((v) => MEAL_VIOLATION_RULE_IDS.has(v.id));

  const [employeeModal, setEmployeeModal] = useState<WaiverFilter | null>(null);
  const openEmployeeModal = (filter: WaiverFilter) => setEmployeeModal(filter);
  const onDutyMembers = ON_DUTY_ROSTER.filter((e) => mp.onDutyEmployees.includes(e.id));
  const breakUsesEndWindow = mp.breakType === "premium";

  const breakSummary = (start: number, end: number, duration: number) =>
    breakUsesEndWindow
      ? `Break required between ${start} and ${end} hrs worked · min ${duration} min`
      : `Break required after ${start} hrs into shift · min ${duration} min`;

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
    { key: "breaks",    label: "Breaks",    show: true },
    { key: "onDuty",    label: "On-Duty Meal",   show: true },
    { key: "kiosk",     label: "Kiosk Break",    show: !!showKiosk },
    { key: "equipment", label: "Equipment",      show: !!showEquipment },
  ];
  const visibleTabs = allTabs.filter((t) => t.show);

  return (
    <>
      {descriptionText && (
        <div className="px-[20px] pt-[14px] pb-[10px]">
          <p className="text-[12px] text-[#464b52] leading-[18px]">{descriptionText}</p>
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
                    <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, fontFamily: "var(--modus-wc-font-family), sans-serif", color: TABLE_HEADER_TEXT, width: 150, borderBottom: `1px solid ${TABLE_HEADER_BORDER}` }} />
                    {colHeaders.map((col) => (
                      <th key={col.key} style={{
                        padding: "10px 8px",
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: "var(--modus-wc-font-family), sans-serif",
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
                        <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, fontFamily: "var(--modus-wc-font-family), sans-serif", color: "#252a2e", whiteSpace: "nowrap", borderRight: `1px solid ${TABLE_HEADER_BORDER}`, borderBottom: isLastRow ? undefined : `1px solid ${TABLE_HEADER_BORDER}` }}>{day.label}</td>
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
              <span className="text-[11px] text-[#464b52]">Flag 24th Consecutive Day</span>
            </button>

            {/* ── Weekly Rules ── */}
            <div className="mt-[24px]">
              <p className="text-[13px] font-semibold text-[#252a2e] mb-[10px]">Weekly Rules</p>
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
                          fontFamily: "var(--modus-wc-font-family), sans-serif",
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



        {/* ── Meal Breaks ── */}
        {activeTab === "breaks" && (
          <div className="flex flex-col gap-[24px] min-w-0">
            <ModusWcAlert variant="info"
              alertTitle="Break Configuration Rules"
              alertDescription="Up to two breaks can be enabled. Both breaks share the same enforcement method (Flagged, Automatic, or Penalty Pay)."
            />

            <div>
              <FieldLabel>Break Enforcement Method</FieldLabel>
              <p className="text-[11px] text-[#6a6e79] mb-[10px]">Configure how break violations are set up in your organization.</p>
              <fieldset className="flex gap-[10px] border-0 p-0 m-0 min-w-0">
                <legend className="sr-only">Break Enforcement Method</legend>
                {([
                  { value: "flagged" as BreakType, title: "Flag", desc: "Violations are flagged for supervisor review." },
                  { value: "automatic" as BreakType, title: "Automatic", desc: "The system inserts qualifying breaks automatically." },
                  { value: "premium" as BreakType, title: "Penalty Pay", desc: "Late or missed breaks trigger automated penalty pay based on configured violation rules." },
                ]).map((opt) => {
                  const selected = mp.breakType === opt.value;
                  return (
                    <div
                      key={opt.value}
                      role="presentation"
                      onClick={() => setMp("breakType", opt.value)}
                      className={`flex-1 min-w-0 cursor-pointer rounded-[6px] border-2 px-[16px] py-[12px] transition-all ${
                        selected
                          ? "border-[#006fb0] bg-[#f5faff]"
                          : "border-[#e0e1e9] bg-white hover:border-[#cbced4]"
                      }`}
                    >
                      <ModusWcRadio
                        name="break-type"
                        size="sm"
                        inputId={`break-type-${opt.value}`}
                        label={opt.title}
                        customClass="font-bold"
                        value={selected}
                        onInputChange={() => setMp("breakType", opt.value)}
                      />
                      <p className="text-[11px] text-[var(--modus-wc-color-base-content-low-contrast)] leading-[16px] mt-[6px] ps-[22px]">
                        {opt.desc}
                      </p>
                    </div>
                  );
                })}
              </fieldset>
            </div>

            {/* Meal 1 */}
            <CardShell title="First Meal" badge="Meal 1" badgeColor="blue"
              action={<SectionEnableToggle enabled={mp.meal1Enabled} onChange={(v) => setMp("meal1Enabled", v)} />}>
              <SectionFieldset enabled={mp.meal1Enabled}>
              <div className="grid grid-cols-2 gap-0" style={{ borderTop: "none" }}>
                <div className="px-[20px] py-[18px]" style={{ borderRight: "1px solid #f0f0f4" }}>
                  <SectionLabel>Break Trigger</SectionLabel>
                  <p className="text-[11px] mb-[12px] leading-[15px]" style={{ color: mp.meal1Enabled ? "#6a6e79" : "#a3a3a3" }}>
                    {breakUsesEndWindow
                      ? "Window measured from shift start."
                      : "Start threshold measured from shift start."}
                  </p>
                  <div className="flex flex-wrap items-end gap-x-[20px] gap-y-[10px]">
                    <div>
                      <p className="text-[11px] mb-[4px]" style={{ color: mp.meal1Enabled ? "#464b52" : "#a3a3a3" }}>Break Must Begin After</p>
                      <NumberInput value={mp.meal1Trigger} onChange={(v) => setMealWindow(1, "start", v)} step={0.5} min={0} suffix="hrs into shift" disabled={!mp.meal1Enabled} />
                    </div>
                    {breakUsesEndWindow && (
                      <div>
                        <p className="text-[11px] mb-[4px]" style={{ color: mp.meal1Enabled ? "#464b52" : "#a3a3a3" }}>Break Must End After</p>
                        <NumberInput value={mp.meal1TriggerEnd} onChange={(v) => setMealWindow(1, "end", v)} step={0.5} min={0} suffix="hrs into shift" disabled={!mp.meal1Enabled} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="px-[20px] py-[18px] flex flex-col gap-[20px]">
                  <div>
                    <SectionLabel>Break Duration</SectionLabel>
                    <FieldLabel>Minimum Required Length</FieldLabel>
                    <NumberInput value={mp.meal1Duration} onChange={(v) => setMp("meal1Duration", v)} step={5} min={0} suffix="min" disabled={!mp.meal1Enabled} />
                  </div>
                  <div className="mt-auto flex items-start gap-[8px] rounded-[6px] bg-[#f1f1f6] px-[12px] py-[10px]">
                    <div className="h-[6px] w-[6px] rounded-full bg-[#006fb0] shrink-0 mt-[4px]" />
                    <p className="text-[11px] text-[#464b52] leading-[16px]">
                      {breakSummary(mp.meal1Trigger, mp.meal1TriggerEnd, mp.meal1Duration)}
                    </p>
                  </div>
                </div>
              </div>
              </SectionFieldset>
            </CardShell>

            {/* Meal 2 */}
            <CardShell title="Second Meal" badge="Meal 2" badgeColor="blue"
              action={<SectionEnableToggle enabled={mp.meal2Enabled} onChange={(v) => setMp("meal2Enabled", v)} />}>
              <SectionFieldset enabled={mp.meal2Enabled}>
              <div className="grid grid-cols-2 gap-0">
                <div className="px-[20px] py-[18px]" style={{ borderRight: "1px solid #f0f0f4" }}>
                  <SectionLabel>Break Trigger</SectionLabel>
                  <p className="text-[11px] mb-[12px] leading-[15px]" style={{ color: mp.meal2Enabled ? "#6a6e79" : "#a3a3a3" }}>
                    {breakUsesEndWindow
                      ? "Window measured from shift start."
                      : "Start threshold measured from shift start."}
                  </p>
                  <div className="flex flex-wrap items-end gap-x-[20px] gap-y-[10px]">
                    <div>
                      <p className="text-[11px] mb-[4px]" style={{ color: mp.meal2Enabled ? "#464b52" : "#a3a3a3" }}>Break Must Begin After</p>
                      <NumberInput value={mp.meal2Trigger} onChange={(v) => setMealWindow(2, "start", v)} step={0.5} min={0} suffix="hrs into shift" disabled={!mp.meal2Enabled} />
                    </div>
                    {breakUsesEndWindow && (
                      <div>
                        <p className="text-[11px] mb-[4px]" style={{ color: mp.meal2Enabled ? "#464b52" : "#a3a3a3" }}>Break Must End After</p>
                        <NumberInput value={mp.meal2TriggerEnd} onChange={(v) => setMealWindow(2, "end", v)} step={0.5} min={0} suffix="hrs into shift" disabled={!mp.meal2Enabled} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="px-[20px] py-[18px] flex flex-col gap-[20px]">
                  <div>
                    <SectionLabel>Break Duration</SectionLabel>
                    <FieldLabel>Minimum Required Length</FieldLabel>
                    <NumberInput value={mp.meal2Duration} onChange={(v) => setMp("meal2Duration", v)} step={5} min={0} suffix="min" disabled={!mp.meal2Enabled} />
                  </div>
                  <div className="mt-auto flex items-start gap-[8px] rounded-[6px] bg-[#f1f1f6] px-[12px] py-[10px]">
                    <div className="h-[6px] w-[6px] rounded-full bg-[#006fb0] shrink-0 mt-[4px]" />
                    <p className="text-[11px] text-[#464b52] leading-[16px]">
                      {breakSummary(mp.meal2Trigger, mp.meal2TriggerEnd, mp.meal2Duration)}
                    </p>
                  </div>
                </div>
              </div>
              </SectionFieldset>
            </CardShell>

            {mp.breakType === "premium" && (
              <CardShell title="Violation Penalties" badge="LC § 226.7" badgeColor="red"
                action={
                  <div className="flex items-center gap-[8px]">
                    <span className="text-[12px] text-[#464b52]">Auto-Calculate Meal Penalty Pay</span>
                    <Toggle
                      enabled={mp.penaltiesEnabled}
                      onChange={(v) => setMp("penaltiesEnabled", v)}
                      ariaLabel="Auto-Calculate Meal Penalty Pay"
                    />
                  </div>
                }>
                <>
                  <div className="px-[20px] pt-[14px] pb-[6px]">
                    <p className="text-[12px] text-[#464b52] leading-[18px]">
                      Configure pay type and rate for each violation. Use the job cost override below to redirect costing for all violations when needed.
                    </p>
                  </div>

                  <div className="px-[20px] pt-[8px] pb-[4px] min-w-0">
                    <p className="text-[13px] font-semibold text-[#252a2e] mb-[10px]">Rest Break Violations</p>
                    <div className="mb-[10px] rounded-[6px] border border-[#cce4f4] bg-[#f5faff] px-[12px] py-[10px]">
                      <p className="text-[11px] text-[#464b52] leading-[16px]">
                        Rest breaks must be specified under{" "}
                        {onOpenAttestationQuestions ? (
                          <button
                            type="button"
                            onClick={onOpenAttestationQuestions}
                            className="inline p-0 border-0 bg-transparent text-[11px] font-medium text-[#006fb0] underline underline-offset-2 cursor-pointer hover:text-[#005a8e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006fb0]"
                          >
                            Attestation Questions
                          </button>
                        ) : (
                          <span className="font-semibold text-[#252a2e]">Attestation Questions</span>
                        )}
                        {" "}and mapped to Missed Rest Break for this penalty to apply.
                      </p>
                    </div>
                    <ViolationRulesTable violations={breakViolationRules()} onUpdate={updateViolation} />
                    <div className="flex items-end gap-[32px] pt-[14px] pb-[4px]">
                      <div>
                        <FieldLabel>Daily Stacking Cap</FieldLabel>
                        <NumberInput value={mp.breakStackingCap} onChange={(v) => setMp("breakStackingCap", v)} step={0.5} min={0} suffix="hr(s)" />
                        <p className="mt-[4px] text-[11px] text-[#6a6e79]">Max total rest break penalty pay per workday across all rest break violations</p>
                      </div>
                    </div>
                  </div>

                  <div className="px-[20px] pt-[20px] pb-[4px] min-w-0 border-t border-[#f0f0f4] mt-[12px]">
                    <p className="text-[13px] font-semibold text-[#252a2e] mb-[10px]">Meal Violations</p>
                    <ViolationRulesTable violations={mealViolationRules()} onUpdate={updateViolation} />
                    <div className="flex items-end gap-[32px] pt-[14px] pb-[4px]">
                      <div>
                        <FieldLabel>Daily Stacking Cap</FieldLabel>
                        <NumberInput value={mp.mealStackingCap} onChange={(v) => setMp("mealStackingCap", v)} step={0.5} min={0} suffix="hr(s)" />
                        <p className="mt-[4px] text-[11px] text-[#6a6e79]">Max total meal penalty pay per workday across all meal violations</p>
                      </div>
                    </div>
                  </div>

                  <div className="px-[20px] pt-[20px] pb-[16px] min-w-0 border-t border-[#f0f0f4] mt-[12px]">
                    {(() => {
                      const override = withJobCostOverrideDefaults(mp.jobCostOverride);
                      const costJob = jobFromCatalog(override.jobCode || JOB_CATALOG[0].code);
                      const jobPhaseOptions = costJob.phases.map((p) => ({ value: p.code, label: `${p.code} - ${p.name}` }));
                      const allPhaseOptions = JOB_CATALOG.flatMap((j) =>
                        j.phases.map((p) => ({ value: p.code, label: `${p.code} - ${p.name}` })),
                      );
                      const fullOverrideIncomplete =
                        override.mode === "department_job_phase"
                        && (!override.department || !override.jobCode || !override.phaseCode);
                      const phaseOverrideIncomplete = override.mode === "phase_only" && !override.phaseCode;

                      const updateOverride = (patch: Partial<JobCostOverrideConfig>) => {
                        setMp("jobCostOverride", withJobCostOverrideDefaults({ ...override, ...patch }));
                      };

                      return (
                        <div className="flex flex-col gap-[24px]">
                          <div>
                            <FieldLabel>Job Cost Override</FieldLabel>
                            <p className="text-[11px] text-[#6a6e79] leading-[16px]">
                              By default, meal penalty pay posts to the employee&apos;s clocked job. Choose one override to apply to <strong>all violations</strong>.
                            </p>
                          </div>
                          <fieldset className="flex flex-col gap-[10px] border-0 p-0 m-0 min-w-0">
                            <legend className="sr-only">Job Cost Override Mode</legend>
                            {([
                              {
                                value: "employee_job" as JobCostOverrideMode,
                                title: "Employee's Clocked Job",
                                desc: "Cost each violation to the department, job, and phase the employee was clocked into.",
                              },
                              {
                                value: "department_job_phase" as JobCostOverrideMode,
                                title: "Department, Job, and Phase",
                                desc: "Route all violation costs to a fixed department, job, and sub-job (e.g. administrative overhead).",
                              },
                              {
                                value: "phase_only" as JobCostOverrideMode,
                                title: "Phase Only",
                                desc: "Keep the employee's clocked department and job; redirect all violations to a single sub-job phase.",
                              },
                            ]).map((opt) => {
                              const selected = override.mode === opt.value;
                              return (
                                <div
                                  key={opt.value}
                                  role="presentation"
                                  onClick={() => updateOverride({ mode: opt.value })}
                                  className={`cursor-pointer rounded-[6px] border-2 px-[16px] py-[12px] transition-all ${
                                    selected
                                      ? "border-[#006fb0] bg-[#f5faff]"
                                      : "border-[#e0e1e9] bg-white hover:border-[#cbced4]"
                                  }`}
                                >
                                  <ModusWcRadio
                                    name="job-cost-override-mode"
                                    size="sm"
                                    inputId={`job-cost-override-${opt.value}`}
                                    label={opt.title}
                                    customClass="font-bold"
                                    value={selected}
                                    onInputChange={() => updateOverride({ mode: opt.value })}
                                  />
                                  <p className="text-[11px] text-[var(--modus-wc-color-base-content-low-contrast)] leading-[16px] mt-[6px] ps-[22px]">
                                    {opt.desc}
                                  </p>
                                  {selected && opt.value === "department_job_phase" && (
                                    <div
                                      className="mt-[12px] ps-[22px] grid grid-cols-1 md:grid-cols-3 gap-[12px] min-w-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <SearchableSelectField
                                        value={override.department}
                                        customClass="w-full min-w-0"
                                        onChange={(val) => updateOverride({ department: val })}
                                        placeholder="Select department"
                                        options={VIOLATION_DEPT_OPTIONS.map((d) => ({ value: d, label: d }))}
                                      />
                                      <SearchableSelectField
                                        value={override.jobCode}
                                        customClass="w-full min-w-0"
                                        onChange={(val) => {
                                          const nextJob = jobFromCatalog(val);
                                          updateOverride({
                                            jobCode: val,
                                            phaseCode: nextJob.phases[0]?.code ?? "",
                                          });
                                        }}
                                        placeholder="Select job"
                                        options={JOB_CATALOG.map((j) => ({ value: j.code, label: `${j.code} - ${j.name}` }))}
                                      />
                                      <SearchableSelectField
                                        value={override.phaseCode}
                                        customClass="w-full min-w-0"
                                        onChange={(val) => updateOverride({ phaseCode: val })}
                                        placeholder="Select sub-job"
                                        options={jobPhaseOptions}
                                      />
                                      {fullOverrideIncomplete && (
                                        <p className="md:col-span-3 text-[11px] text-[#b45309]">Complete department, job, and sub-job.</p>
                                      )}
                                    </div>
                                  )}
                                  {selected && opt.value === "phase_only" && (
                                    <div
                                      className="mt-[12px] ps-[22px] max-w-[320px] min-w-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <SearchableSelectField
                                        value={override.phaseCode}
                                        customClass="w-full min-w-0"
                                        onChange={(val) => updateOverride({ phaseCode: val })}
                                        placeholder="Select sub-job phase"
                                        options={allPhaseOptions}
                                      />
                                      {phaseOverrideIncomplete && (
                                        <p className="mt-[4px] text-[11px] text-[#b45309]">Select a sub-job phase.</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </fieldset>
                        </div>
                      );
                    })()}
                  </div>
                </>
              </CardShell>
            )}

            <CardShell title="Custom Reminders & Notifications" badge="Meal Breaks" badgeColor="blue"
              action={<SectionEnableToggle enabled={mp.freeMealEnabled} onChange={(v) => setMp("freeMealEnabled", v)} />}>
              <SectionFieldset enabled={mp.freeMealEnabled}>
                <div className="px-[20px] pt-[14px] pb-[2px]">
                  <p className="text-[12px] text-[#464b52] leading-[18px]">
                    Configure when employees are prompted during breaks, and customize the message they see.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-[24px] px-[20px] py-[14px]">
                  <div>
                    <SectionLabel>When to Notify</SectionLabel>
                    <SelectField value={mp.freeMealTrigger} onChange={(v) => setMp("freeMealTrigger", v as FreeMealTrigger)}
                      disabled={!mp.freeMealEnabled}
                      options={[
                        { value: "always", label: "Every break" },
                        { value: "before_threshold", label: "Before threshold by..." },
                        { value: "exceeding", label: "Only for breaks exceeding..." },
                      ]} />
                    {mp.freeMealTrigger === "before_threshold" && (
                      <div className="mt-[8px] flex flex-col gap-[6px]">
                        <NumberInput value={mp.freeMealBeforeMinutes} onChange={(v) => setMp("freeMealBeforeMinutes", v)} step={1} min={1} suffix="min before" disabled={!mp.freeMealEnabled} />
                        <p className="text-[11px] text-[#6a6e79] leading-[15px]">
                          Employee is notified {mp.freeMealBeforeMinutes} min before the break threshold is reached.
                        </p>
                      </div>
                    )}
                    {mp.freeMealTrigger === "exceeding" && (
                      <div className="mt-[8px] flex items-center gap-[6px]">
                        <span className="text-[12px] text-[#464b52]">Longer Than:</span>
                        <NumberInput value={mp.freeMealMinutes} onChange={(v) => setMp("freeMealMinutes", v)} step={5} min={1} suffix="min" disabled={!mp.freeMealEnabled} />
                      </div>
                    )}
                  </div>
                  <div className="col-span-2">
                    <SectionLabel>Notification Message</SectionLabel>
                    <ModusWcTextarea aria-label="Notification Message" value={mp.freeMealPrompt}
                      disabled={!mp.freeMealEnabled}
                      onInputChange={(e) => setMp("freeMealPrompt", readInputString(e as CustomEvent))} rows={3} maxLength={200}
                      placeholder="Enter the message employees will see during their break..." />
                    <p className="mt-[4px] text-[11px] text-[#6a6e79]">{mp.freeMealPrompt.length}/200 characters</p>
                  </div>
                </div>
              </SectionFieldset>
            </CardShell>
          </div>
        )}

        {/* ── On-Duty Meal ── */}
        {activeTab === "onDuty" && (
          <div className="flex flex-col gap-[24px]">
            <ModusWcAlert variant="info"
              alertTitle="Separate from standard breaks"
              alertDescription="On-duty meal is configured separately from standard breaks to meet California Labor Code requirements."
            />
            <CardShell title="On-Duty Meal" badge="CA Labor Code § 512(e)" badgeColor="blue"
              action={<SectionEnableToggle enabled={mp.onDutyMealEnabled} onChange={(v) => setMp("onDutyMealEnabled", v)} />}>
              <SectionFieldset enabled={mp.onDutyMealEnabled}>
                <div className="grid grid-cols-3 gap-[28px] px-[20px] py-[18px]">
                  <div>
                    <SectionLabel>Waiver Requirement</SectionLabel>
                    <div className="flex items-start gap-[10px]">
                      <Toggle enabled={mp.onDutyRequireAgreement} disabled={!mp.onDutyMealEnabled} onChange={(v) => setMp("onDutyRequireAgreement", v)} />
                      <span className="text-[12px] text-[#252a2e] leading-[20px]">
                        Allowed only for employees assigned the waiver
                      </span>
                    </div>
                    {mp.onDutyRequireAgreement && (
                      <div className="mt-[10px] flex items-start gap-[8px] rounded-[6px] bg-[#eef5fa] px-[10px] py-[8px]">
                        <Info size={13} className="mt-[1px] shrink-0 text-[#006fb0]" />
                        <p className="text-[11px] text-[#464b52] leading-[16px]">
                          Employee must be assigned the on-duty meal waiver before this meal type can be recorded.
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <SectionLabel>When Taken Without Waiver</SectionLabel>
                    <div className="flex flex-col gap-[4px]">
                      {([
                        { value: "flag", label: "Flag entry only" },
                        { value: "pay_time_worked", label: "Pay as time worked" },
                        { value: "flag_and_pay", label: "Flag & pay as time worked" },
                      ] as { value: OnDutyMealAction; label: string }[]).map((opt) => (
                        <SoftOption key={opt.value} selected={mp.onDutyNoAgreementAction === opt.value}
                          disabled={!mp.onDutyMealEnabled}
                          onSelect={() => setMp("onDutyNoAgreementAction", opt.value)} title={opt.label} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <SectionLabel>Effective Behavior</SectionLabel>
                    <div className="rounded-[6px] bg-[#f1f1f6] px-[12px] py-[12px] flex flex-col gap-[8px]">
                      <div className="flex items-start gap-[6px]">
                        <Check size={12} className="mt-[2px] shrink-0 text-[#28a745]" />
                        <span className="text-[11px] text-[#464b52] leading-[16px]">
                          {mp.onDutyRequireAgreement ? "Waiver required to record on-duty meal" : "No waiver required"}
                        </span>
                      </div>
                      <div className="flex items-start gap-[6px]">
                        <AlertTriangle size={12} className="mt-[2px] shrink-0 text-[#856404]" />
                        <span className="text-[11px] text-[#464b52] leading-[16px]">
                          Without waiver:{" "}
                          {mp.onDutyNoAgreementAction === "flag" && "entry flagged for review"}
                          {mp.onDutyNoAgreementAction === "pay_time_worked" && "on-duty meal paid as time worked"}
                          {mp.onDutyNoAgreementAction === "flag_and_pay" && "flagged and paid as time worked"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-[20px] pt-[16px] pb-[18px]" style={{ borderTop: "1px solid #e0e1e9" }}>
                  <SectionLabel>Assigned Employees</SectionLabel>
                  <div className="flex flex-wrap items-center justify-between gap-[12px] rounded-[6px] px-[12px] py-[10px]"
                    style={{ background: "#f7f7fb", border: "1px solid #e0e1e9" }}>
                    <div className="flex items-center gap-[8px]">
                      <Users size={14} style={{ color: "#6a6e79" }} />
                      <span className="text-[12px] text-[#252a2e]">
                        {onDutyMembers.length === 0
                          ? "No employees assigned the waiver yet"
                          : `${onDutyMembers.length} of ${ON_DUTY_ROSTER.length} employees assigned the waiver`}
                      </span>
                    </div>
                    <ModusWcButton color="primary" variant="outlined" size="sm"
                      disabled={!mp.onDutyMealEnabled}
                      onButtonClick={() => openEmployeeModal("all")}>
                      <ModusWcIcon decorative name="manage_people" size="xs" />
                      Manage employees
                    </ModusWcButton>
                  </div>
                </div>
              </SectionFieldset>
            </CardShell>
            {employeeModal && (
              <OnDutyEmployeeModal selected={mp.onDutyEmployees} initialFilter={employeeModal}
                onApply={(ids) => setMp("onDutyEmployees", ids)} onClose={() => setEmployeeModal(null)} />
            )}
          </div>
        )}

        {/* ── Kiosk Break ── */}
        {activeTab === "kiosk" && showKiosk && (
          <>
            <p className="text-[12px] text-[#464b52] leading-[18px] mb-[14px]">
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
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, fontFamily: "var(--modus-wc-font-family), sans-serif", color: "#ffffff" }}>
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
          <p style={{ margin: 0, fontSize: 12, fontFamily: "var(--modus-wc-font-family), sans-serif", color: "#0e416c", lineHeight: "18px" }}>
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
                  fontFamily: "var(--modus-wc-font-family), sans-serif",
                }}>
                  {idx + 1}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--modus-wc-font-family), sans-serif", color: "#252a2e" }}>
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

function HourRulesTab({
  onSave,
  onOpenAttestationQuestions,
}: {
  onSave: () => void;
  onOpenAttestationQuestions?: () => void;
}) {
  // Company
  const { companyMealPenalty, setCompanyMealPenalty: _setCompanyMealPenalty } = useMealPenaltyConfig();
  const [companyRules, _setCompanyRules] = useState<RuleSetData>(defaultRuleSet());
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
  const [useCustomRuleOrder, setUseCustomRuleOrder] = useState(false);

  return (
    <div className="flex flex-col gap-[28px]">
      <Checkbox
        checked={useCustomRuleOrder}
        onChange={(v) => {
          setUseCustomRuleOrder(v);
          onSave();
        }}
        label="Use custom order when applying rules (if not, will look for the lowest allowed per hour type that applies)"
      />

      {useCustomRuleOrder && <PrecedenceSection />}

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
            onOpenAttestationQuestions={onOpenAttestationQuestions}
          />
        </SectionBody>
      </div>

      {/* ── State ── */}
      <div>
        <SectionDivider>State Timesheet Hour Rules</SectionDivider>
        <SectionBody>
          {/* Selector bar */}
          <div className="flex items-center gap-[10px] px-[20px] py-[14px] border-b border-[#f0f0f4]">
            <p className="text-[12px] text-[#464b52] shrink-0">
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
                className="flex items-center gap-[5px] rounded-[4px] bg-[#006fb0] px-[12px] py-[5px] text-[11px] font-semibold text-white hover:bg-[#005a8e] transition-colors">
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
                    className={`rounded-full px-[10px] py-[2px] text-[11px] font-semibold transition-colors ${selectedState === code ? "bg-[#006fb0] text-white" : "bg-[#dcedf9] text-[#006fb0] hover:bg-[#b8d9f0]"}`}>
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
              onOpenAttestationQuestions={onOpenAttestationQuestions}
            />
          ) : (
            <div className="px-[20px] py-[20px] text-center">
              <p className="text-[12px] text-[#6a6e79]">
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
            <p className="text-[12px] text-[#464b52] shrink-0">
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
                className="flex items-center gap-[5px] rounded-[4px] bg-[#006fb0] px-[12px] py-[5px] text-[11px] font-semibold text-white hover:bg-[#005a8e] transition-colors">
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
                    className={`rounded-full px-[10px] py-[2px] text-[11px] font-semibold transition-colors ${selectedUnion === code ? "bg-[#006fb0] text-white" : "bg-[#dcedf9] text-[#006fb0] hover:bg-[#b8d9f0]"}`}>
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
              onOpenAttestationQuestions={onOpenAttestationQuestions}
            />
          ) : (
            <div className="px-[20px] py-[20px] text-center">
              <p className="text-[12px] text-[#6a6e79]">
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

const VIOLATION_DEPT_OPTIONS = ["3300 - Job Cost", "3400 - Operations", "3500 - Admin"];

const jobFromCatalog = (code: string) => JOB_CATALOG.find((j) => j.code === code) ?? JOB_CATALOG[0];

const RATE_LEVEL_OPTIONS = ["Holiday", "Standby", "Shift Differential", "Apprentice"];

type ExclusionKind = "job" | "phase" | "rate";

// Lets a job exclusion cover the whole job rather than one phase on it.
const ALL_PHASES = "__all__";

type PhaseCatalogEntry = { job: JobOption; phase: PhaseOption };

const PHASE_CATALOG: PhaseCatalogEntry[] = JOB_CATALOG.flatMap((job) =>
  job.phases.map((phase) => ({ job, phase })),
);

const phaseKeyFor = (jobCode: string, phaseCode: string) => `${jobCode}|${phaseCode}`;

const parsePhaseKey = (key: string): PhaseCatalogEntry => {
  const [jobCode, phaseCode] = key.split("|");
  const job = JOB_CATALOG.find((j) => j.code === jobCode) ?? JOB_CATALOG[0];
  const phase = job.phases.find((p) => p.code === phaseCode) ?? job.phases[0];
  return { job, phase };
};

function ExclusionPicker({ kind, existing, onClose, onAdd }: {
  kind: ExclusionKind;
  existing: ExclusionItem[];
  onClose: () => void;
  onAdd: (item: { label: string; subLabel?: string }) => void;
}) {
  const [jobCode, setJobCode] = useState(JOB_CATALOG[0].code);
  const [phaseCode, setPhaseCode] = useState(ALL_PHASES);
  const [phaseKey, setPhaseKey] = useState(
    phaseKeyFor(JOB_CATALOG[0].code, JOB_CATALOG[0].phases[0].code),
  );
  const [rateLevel, setRateLevel] = useState(RATE_LEVEL_OPTIONS[0]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const job = JOB_CATALOG.find(j => j.code === jobCode) ?? JOB_CATALOG[0];
  const phase = job.phases.find(p => p.code === phaseCode);
  const phaseEntry = parsePhaseKey(phaseKey);

  const draft =
    kind === "rate" ? { label: rateLevel } :
    kind === "phase" ? {
      label: `${phaseEntry.job.code} · ${phaseEntry.phase.code}`,
      subLabel: `${phaseEntry.job.name} — ${phaseEntry.phase.name}`,
    } :
    phase ? { label: `${job.code} · ${phase.code}`, subLabel: `${job.name} — ${phase.name}` } :
            { label: job.code, subLabel: `${job.name} — all phases` };

  const duplicate = existing.some(item => item.label === draft.label);
  const title = kind === "job" ? "Exclude a Job" : kind === "phase" ? "Exclude a Phase" : "Exclude a Rate Level";
  const hint =
    kind === "rate" ? "Hours at the selected rate level are skipped by the rules." :
    kind === "phase" ? "Only the selected phase is excluded on this job." :
    phase ? "Only the selected phase is excluded on this job." :
            "Every phase on the selected job is excluded.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px]" onClick={onClose}>
      <div className="relative w-[440px] rounded-[8px] bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#e0e1e9] px-[20px] py-[14px]">
          <span className="text-[14px] font-bold text-[#252a2e]">{title}</span>
          <button onClick={onClose} className="text-[#6a6e79] hover:text-[#252a2e] transition-colors"><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-[14px] px-[20px] py-[16px]">
          {kind === "rate" ? (
            <ModusWcSelect
              label="Rate level"
              size="sm"
              value={rateLevel}
              options={RATE_LEVEL_OPTIONS.map(r => ({ label: r, value: r }))}
              onInputChange={(e) => setRateLevel(readInputString(e as CustomEvent))}
            />
          ) : kind === "phase" ? (
            <ModusWcSelect
              label="Phase"
              size="sm"
              value={phaseKey}
              options={PHASE_CATALOG.map(({ job: j, phase: p }) => ({
                label: `${j.code} · ${p.code} - ${p.name}`,
                value: phaseKeyFor(j.code, p.code),
              }))}
              onInputChange={(e) => setPhaseKey(readInputString(e as CustomEvent))}
            />
          ) : (
            <>
              <ModusWcSelect
                label="Job"
                size="sm"
                value={jobCode}
                options={JOB_CATALOG.map(j => ({ label: `${j.code} - ${j.name}`, value: j.code }))}
                onInputChange={(e) => {
                  const next = readInputString(e as CustomEvent);
                  setJobCode(next);
                  // The phase list is scoped to the job, so the old pick may not exist here.
                  const nextJob = JOB_CATALOG.find(j => j.code === next);
                  if (nextJob) setPhaseCode(ALL_PHASES);
                }}
              />
              <ModusWcSelect
                label="Phase"
                size="sm"
                value={phase ? phase.code : ALL_PHASES}
                options={[
                  { label: "All phases", value: ALL_PHASES },
                  ...job.phases.map(p => ({ label: `${p.code} - ${p.name}`, value: p.code })),
                ]}
                onInputChange={(e) => setPhaseCode(readInputString(e as CustomEvent))}
              />
            </>
          )}
          <p className="text-[11px] leading-[16px]"
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
            <p className="text-[12px] text-[#464b52] leading-[18px]">{description}</p>
            <div className="ml-[16px] shrink-0">
              <ModusWcButton color="primary" variant="outlined" size="sm" onButtonClick={onAdd}>
                <ModusWcIcon decorative name="add" size="xs" />
                Add
              </ModusWcButton>
            </div>
          </div>
          {items.length === 0 ? (
            <p className="text-[12px] text-[#6a6e79] italic">No excluded items configured.</p>
          ) : (
            <div className="flex flex-col divide-y divide-[#f0f0f4]">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-[8px]">
                  <div>
                    <span className="text-[12px] font-semibold text-[#252a2e]">{item.label}</span>
                    {item.subLabel && <span className="ml-[6px] text-[12px] text-[#6a6e79]">— {item.subLabel}</span>}
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

type OnDutyEmployee = { id: string; name: string; title: string; department: string; costCenter: string };

// Stands in for a paged employee lookup; a real tenant roster is far larger.
const ON_DUTY_ROSTER: OnDutyEmployee[] = [
  { id: "e01", name: "Adam Reyes",        title: "Gate Guard",         department: "3400 - Operations", costCenter: "CC-100" },
  { id: "e02", name: "Priya Natarajan",   title: "Patrol Officer",     department: "3400 - Operations", costCenter: "CC-100" },
  { id: "e03", name: "Marcus Webb",       title: "Night Guard",        department: "3400 - Operations", costCenter: "CC-100" },
  { id: "e04", name: "Dana Whitfield",    title: "Gate Guard",         department: "3400 - Operations", costCenter: "CC-100" },
  { id: "e05", name: "Luis Ferreira",     title: "Crane Operator",     department: "3300 - Job Cost",   costCenter: "CC-200" },
  { id: "e06", name: "Grace Okonkwo",     title: "Loader Operator",    department: "3300 - Job Cost",   costCenter: "CC-200" },
  { id: "e07", name: "Tom Halvorsen",     title: "Excavator Operator", department: "3300 - Job Cost",   costCenter: "CC-200" },
  { id: "e08", name: "Sofia Marchetti",   title: "Grader Operator",    department: "3300 - Job Cost",   costCenter: "CC-200" },
  { id: "e09", name: "Ray Kimura",        title: "Dispatcher",         department: "3500 - Admin",      costCenter: "CC-300" },
  { id: "e10", name: "Elena Vasquez",     title: "Control Room Lead",  department: "3500 - Admin",      costCenter: "CC-300" },
  { id: "e11", name: "Jordan Pace",       title: "Dispatcher",         department: "3500 - Admin",      costCenter: "CC-300" },
  { id: "e12", name: "Nadia Farouk",      title: "Site Medic",         department: "3400 - Operations", costCenter: "CC-100" },
  { id: "e13", name: "Colin Barrett",     title: "Site Medic",         department: "3400 - Operations", costCenter: "CC-100" },
  { id: "e14", name: "Hannah Lindqvist",  title: "Utility Tech",       department: "3300 - Job Cost",   costCenter: "CC-200" },
  { id: "e15", name: "Devon Achebe",      title: "Utility Tech",       department: "3300 - Job Cost",   costCenter: "CC-200" },
  { id: "e16", name: "Mei Ling Chen",     title: "Site Supervisor",    department: "3400 - Operations", costCenter: "CC-200" },
  { id: "e17", name: "Owen Brady",        title: "Fuel Truck Driver",  department: "3300 - Job Cost",   costCenter: "CC-300" },
  { id: "e18", name: "Aisha Rahman",      title: "Weighbridge Clerk",  department: "3500 - Admin",      costCenter: "CC-300" },
];

type MealPenaltyState = {
  breakType: BreakType;
  meal1Enabled: boolean; meal1Trigger: number; meal1TriggerEnd: number; meal1Duration: number; meal1Schedule: ScheduleType;
  meal1WindowStart: string; meal1WindowEnd: string;
  meal2Enabled: boolean; meal2Trigger: number; meal2TriggerEnd: number; meal2Duration: number; meal2Schedule: ScheduleType;
  meal2WindowStart: string; meal2WindowEnd: string;
  freeMealEnabled: boolean; freeMealTrigger: FreeMealTrigger;
  freeMealMinutes: number; freeMealBeforeMinutes: number; freeMealPrompt: string;
  onDutyMealEnabled: boolean; onDutyRequireAgreement: boolean; onDutyNoAgreementAction: OnDutyMealAction;
  onDutyEmployees: string[];
  penaltiesEnabled: boolean;
  breakStackingCap: number;
  mealStackingCap: number;
  violations: ViolationRule[];
  jobCostOverride: JobCostOverrideConfig;
};

type PayType = "regular" | "overtime" | "double_time" | "flat";

type JobCostOverrideMode = "employee_job" | "department_job_phase" | "phase_only";

type JobCostOverrideConfig = {
  mode: JobCostOverrideMode;
  department: string;
  jobCode: string;
  phaseCode: string;
};

type ViolationRule = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  payType: PayType;
  hoursRate: number;
  maxPenalty: number;
};

const VIOLATION_DESCRIPTIONS: Record<string, string> = {
  missed_break_attestation: "Coffee breaks not clocked out for — through attestation.",
  missed_meal: "Meal penalty applies when a required meal break was not taken.",
  late_meal: "Meal penalty applies when a meal break was taken outside the compliance window.",
  short_meal: "Meal penalty applies when a meal break was shorter than the minimum required duration.",
};

const defaultJobCostOverride = (): JobCostOverrideConfig => ({
  mode: "employee_job",
  department: "3500 - Admin",
  jobCode: JOB_CATALOG[0].code,
  phaseCode: JOB_CATALOG[0].phases[0].code,
});

const withJobCostOverrideDefaults = (row?: Partial<JobCostOverrideConfig>): JobCostOverrideConfig => ({
  ...defaultJobCostOverride(),
  ...row,
  mode: row?.mode ?? "employee_job",
  department: row?.department ?? "3500 - Admin",
  jobCode: row?.jobCode ?? JOB_CATALOG[0].code,
  phaseCode: row?.phaseCode ?? JOB_CATALOG[0].phases[0].code,
});

const withViolationDefaults = (v: ViolationRule): ViolationRule => ({
  ...v,
  description: v.description ?? VIOLATION_DESCRIPTIONS[v.id] ?? "",
});

const defaultViolations = (): ViolationRule[] => [
  { id: "missed_break_attestation", label: "Missed Rest Break", description: VIOLATION_DESCRIPTIONS.missed_break_attestation, enabled: true, payType: "regular", hoursRate: 1.0, maxPenalty: 1.0 },
  { id: "missed_meal", label: "Missed Meal", description: VIOLATION_DESCRIPTIONS.missed_meal, enabled: true, payType: "regular", hoursRate: 1.0, maxPenalty: 1.0 },
  { id: "late_meal", label: "Late Meal", description: VIOLATION_DESCRIPTIONS.late_meal, enabled: true, payType: "regular", hoursRate: 1.0, maxPenalty: 1.0 },
  { id: "short_meal", label: "Short Meal", description: VIOLATION_DESCRIPTIONS.short_meal, enabled: true, payType: "regular", hoursRate: 1.0, maxPenalty: 1.0 },
];

const BREAK_VIOLATION_RULE_IDS = new Set(["missed_break_attestation"]);
const MEAL_VIOLATION_RULE_IDS = new Set(["missed_meal", "late_meal", "short_meal"]);

function ViolationRulesTable({
  violations,
  onUpdate,
}: {
  violations: ViolationRule[];
  onUpdate: (id: string, patch: Partial<ViolationRule>) => void;
}) {
  return (
    <div className="rounded-[6px] border border-[#e0e1e9] min-w-0">
      <table className="w-full border-collapse text-[12px]" style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "8%" }} />
          <col style={{ width: "42%" }} />
          <col style={{ width: "30%" }} />
          <col style={{ width: "20%" }} />
        </colgroup>
        <thead>
          <tr className="bg-[#f5f5f8]">
            <th className="border-b border-[#e0e1e9] px-[8px] py-[8px] text-left text-[12px] font-semibold text-[#6a6e79]" />
            <th className="border-b border-[#e0e1e9] px-[8px] py-[8px] text-left text-[12px] font-semibold text-[#6a6e79]">Violation Type</th>
            <th className="border-b border-[#e0e1e9] px-[8px] py-[8px] text-left text-[12px] font-semibold text-[#6a6e79]">Pay Type</th>
            <th className="border-b border-[#e0e1e9] px-[8px] py-[8px] text-center text-[12px] font-semibold text-[#6a6e79]">Penalty Amount</th>
          </tr>
        </thead>
        <tbody>
          {violations.map((raw, idx) => {
            const v = withViolationDefaults(raw);
            const rowFieldsDisabled = !v.enabled;

            return (
              <tr
                key={v.id}
                className={`${idx % 2 === 0 ? "bg-white" : "bg-[#fafafa]"} ${!v.enabled ? "opacity-50" : ""}`}
              >
                <td className="border-b border-[#e0e1e9] px-[8px] py-[10px] text-center">
                  <Toggle
                    enabled={v.enabled}
                    onChange={(val) => onUpdate(v.id, { enabled: val })}
                  />
                </td>
                <td className="border-b border-[#e0e1e9] px-[8px] py-[10px] min-w-0">
                  <ModusWcTooltip
                    content={v.description}
                    position="auto"
                    tooltipId={`violation-tip-${v.id}`}
                  >
                    <button
                      type="button"
                      className="text-left text-[12px] font-semibold text-[#252a2e] bg-transparent border-0 p-0 cursor-help break-words min-w-0"
                      aria-describedby={`violation-tip-${v.id}`}
                    >
                      {v.label}
                    </button>
                  </ModusWcTooltip>
                </td>
                <td className="border-b border-[#e0e1e9] px-[8px] py-[8px] min-w-0">
                  <div className="min-w-0">
                    <SelectField value={v.payType} onChange={(val) => onUpdate(v.id, { payType: val as PayType })}
                      disabled={rowFieldsDisabled}
                      customClass="w-full min-w-0"
                      options={[
                        { value: "regular", label: "Regular Rate" },
                        { value: "overtime", label: "Overtime Rate (1.5×)" },
                        { value: "double_time", label: "Double Time (2×)" },
                        { value: "flat", label: "Flat Dollar Amount" },
                      ]} />
                  </div>
                </td>
                <td className="border-b border-[#e0e1e9] px-[8px] py-[8px] text-center min-w-0">
                  <div className="flex justify-center min-w-0">
                    <NumberInput value={v.hoursRate} onChange={(val) => onUpdate(v.id, { hoursRate: val })}
                      disabled={rowFieldsDisabled}
                      step={0.25} min={0} width={72} suffix={v.payType === "flat" ? "$" : "hr(s)"} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function getConfiguredPenaltyViolationOptions(mp: MealPenaltyState): { value: string; label: string }[] {
  if (mp.breakType !== "premium" || !mp.penaltiesEnabled) return [];
  return (mp.violations ?? defaultViolations())
    .filter((v) => {
      const rule = withViolationDefaults(v);
      return rule.enabled && (BREAK_VIOLATION_RULE_IDS.has(rule.id) || MEAL_VIOLATION_RULE_IDS.has(rule.id));
    })
    .map((v) => ({ value: withViolationDefaults(v).id, label: withViolationDefaults(v).label }));
}

function penaltyViolationMappingAvailable(mp: MealPenaltyState): boolean {
  return getConfiguredPenaltyViolationOptions(mp).length > 0;
}

type AttestationAnswer = "yes" | "no";

type AttestationQuestion = {
  id: string;
  question: string;
  validAnswer: AttestationAnswer;
  requireComment: boolean;
  requireCommentOnInvalid: boolean;
  safetyRelated: boolean;
  violationId: string;
  persisted: boolean;
};

const defaultAttestationQuestions = (): AttestationQuestion[] => [
  {
    id: "aq_breaks",
    question: "Did you take your breaks today?",
    validAnswer: "yes",
    requireComment: false,
    requireCommentOnInvalid: true,
    safetyRelated: false,
    violationId: "",
    persisted: true,
  },
  {
    id: "aq_injury",
    question: "Were you hurt on the job today?",
    validAnswer: "no",
    requireComment: false,
    requireCommentOnInvalid: false,
    safetyRelated: true,
    violationId: "",
    persisted: true,
  },
  {
    id: "aq_missed_meal",
    question: "Did you take your required meal break today?",
    validAnswer: "yes",
    requireComment: false,
    requireCommentOnInvalid: true,
    safetyRelated: false,
    violationId: "missed_meal",
    persisted: true,
  },
];

type AttestationConfigContextValue = {
  questions: AttestationQuestion[];
  setQuestions: React.Dispatch<React.SetStateAction<AttestationQuestion[]>>;
};

const AttestationConfigContext = createContext<AttestationConfigContextValue | null>(null);

function useAttestationConfig() {
  const ctx = useContext(AttestationConfigContext);
  if (!ctx) throw new Error("useAttestationConfig must be used within AttestationConfigProvider");
  return ctx;
}

type MealPenaltyConfigContextValue = {
  companyMealPenalty: MealPenaltyState;
  setCompanyMealPenalty: React.Dispatch<React.SetStateAction<MealPenaltyState>>;
};

const MealPenaltyConfigContext = createContext<MealPenaltyConfigContextValue | null>(null);

function useMealPenaltyConfig() {
  const ctx = useContext(MealPenaltyConfigContext);
  if (!ctx) throw new Error("useMealPenaltyConfig must be used within MealPenaltyConfigProvider");
  return ctx;
}

type ViewingRole = "admin" | "supervisor" | "foreman" | "payroll";

const VIEWING_ROLE_LABELS: Record<ViewingRole, string> = {
  admin: "System Administrator",
  supervisor: "Supervisor",
  foreman: "Foreman",
  payroll: "Payroll Officer",
};

type ViewingRoleContextValue = {
  viewingAs: ViewingRole;
  setViewingAs: (role: ViewingRole) => void;
  canDeleteBreakViolations: boolean;
  viewerLabel: string;
};

const ViewingRoleContext = createContext<ViewingRoleContextValue | null>(null);

function useViewingRole() {
  const ctx = useContext(ViewingRoleContext);
  if (!ctx) throw new Error("useViewingRole must be used within ViewingRoleProvider");
  return ctx;
}

function AttestationYesNoToggle({
  value,
  onChange,
  disabled = false,
  ariaLabel = "Toggle yes or no",
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`relative inline-grid grid-cols-2 rounded-[6px] border border-[#d4d6dd] bg-[#eef0f4] p-[3px] ${disabled ? "opacity-60 pointer-events-none" : ""}`}
      style={{ minWidth: 112, fontFamily: "var(--modus-wc-font-family), sans-serif" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute top-[3px] bottom-[3px] rounded-[4px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.14)] transition-[left] duration-200 ease-out"
        style={{
          width: "calc(50% - 3px)",
          left: value ? 3 : "calc(50%)",
        }}
      />
      <button
        type="button"
        role="radio"
        aria-checked={value}
        onClick={() => onChange(true)}
        className="relative z-[1] rounded-[4px] px-[10px] py-[5px] text-[12px] font-semibold transition-colors duration-200"
        style={{
          color: value ? "#0063a3" : "#6a6e79",
          background: "transparent",
          border: "none",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        Yes
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={!value}
        onClick={() => onChange(false)}
        className="relative z-[1] rounded-[4px] px-[10px] py-[5px] text-[12px] font-semibold transition-colors duration-200"
        style={{
          color: !value ? "#0063a3" : "#6a6e79",
          background: "transparent",
          border: "none",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        No
      </button>
    </div>
  );
}

function AttestationValidAnswerToggle({
  value,
  onChange,
  disabled = false,
}: {
  value: AttestationAnswer;
  onChange: (v: AttestationAnswer) => void;
  disabled?: boolean;
}) {
  return (
    <AttestationYesNoToggle
      value={value === "yes"}
      onChange={(v) => onChange(v ? "yes" : "no")}
      disabled={disabled}
      ariaLabel="Valid answer"
    />
  );
}

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
        <span className="text-[12px] text-[#6a6e79] pb-[9px]">to</span>
        <ModusWcTimeInput
          label="Window closes"
          size="sm"
          value={end}
          onInputChange={(e) => onEnd(e.target.value)}
        />
      </div>
      <p className="text-[11px] leading-[16px] mt-[8px]"
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
  breakType: "flagged",
  meal1Enabled: true, meal1Trigger: 5, meal1TriggerEnd: 6, meal1Duration: 30, meal1Schedule: "relative", meal1WindowStart: "12:00", meal1WindowEnd: "13:00",
  meal2Enabled: true, meal2Trigger: 10, meal2TriggerEnd: 11, meal2Duration: 30, meal2Schedule: "relative", meal2WindowStart: "17:00", meal2WindowEnd: "18:00",
  freeMealEnabled: true, freeMealTrigger: "always", freeMealMinutes: 30, freeMealBeforeMinutes: 10,
  freeMealPrompt: "Was this meal provided free of charge by the employer?",
  onDutyMealEnabled: true, onDutyRequireAgreement: true, onDutyNoAgreementAction: "flag_and_pay",
  onDutyEmployees: ["e01", "e02", "e03", "e05", "e06", "e09", "e12"],
  penaltiesEnabled: true, breakStackingCap: 2.0, mealStackingCap: 2.0, violations: defaultViolations(), jobCostOverride: defaultJobCostOverride(),
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
        <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--modus-wc-font-family), sans-serif", color: "#0e416c" }}>
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
  disabled = false,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      onClick={() => { if (!disabled) onSelect(); }}
      style={{
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
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
        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--modus-wc-font-family), sans-serif", color: "#252a2e" }}>
          {title}
        </span>
      </div>
      {description && (
        <p style={{ margin: "0 0 8px 22px", fontSize: 11, fontFamily: "var(--modus-wc-font-family), sans-serif", color: "#6a6e79", lineHeight: "15px" }}>
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
          <span className="text-[14px] font-bold text-[#252a2e]">Load Statutory Presets</span>
          <button onClick={onClose} className="text-[#6a6e79] hover:text-[#252a2e] transition-colors"><X size={18} /></button>
        </div>
        <div className="px-[20px] py-[16px]">
          <div className="mb-[16px] flex gap-[10px] rounded-[4px] border border-[#fbad26] bg-[#fffbf0] p-[12px]">
            <AlertTriangle size={16} className="mt-[1px] shrink-0 text-[#856404]" />
            <p className="text-[12px] text-[#5a4a00] leading-[18px]">This action will overwrite all existing unsaved configurations with California baseline statutory values.</p>
          </div>
          <ul className="flex flex-col gap-[4px]">
            {["5-hour meal trigger for Meal 1", "30-minute meal duration", "10-hour trigger for Meal 2", "LC § 226.7 meal penalty pay defaults", "Company → Union → State rule precedence"].map((item) => (
              <li key={item} className="flex items-center gap-[6px] text-[12px] text-[#464b52]">
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

// ─── Timesheet Settings ───────────────────────────────────────────────────────
function TimesheetSettings() {
  const { questions, setQuestions } = useAttestationConfig();
  const { companyMealPenalty } = useMealPenaltyConfig();
  const [draftQuestions, setDraftQuestions] = useState<AttestationQuestion[]>(questions);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const violationOptions = getConfiguredPenaltyViolationOptions(companyMealPenalty);
  const penaltyViolationSelectable = penaltyViolationMappingAvailable(companyMealPenalty);

  const updateQuestion = (id: string, patch: Partial<AttestationQuestion>) => {
    setDraftQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };

  const addQuestion = () => {
    setDraftQuestions((prev) => [
      ...prev,
      {
        id: `aq_${Date.now()}`,
        question: "",
        validAnswer: "yes",
        requireComment: false,
        requireCommentOnInvalid: false,
        safetyRelated: false,
        violationId: "",
        persisted: false,
      },
    ]);
  };

  const removeQuestion = (id: string) => {
    setDraftQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleSave = () => {
    const incomplete = draftQuestions.some((q) => !q.question.trim());
    if (incomplete) {
      toast.error("Each question must have text before saving.");
      return;
    }
    const saved = draftQuestions.map((q) => ({
      ...q,
      persisted: true,
      violationId: penaltyViolationSelectable ? q.violationId : "",
    }));
    setDraftQuestions(saved);
    setQuestions(saved);
    setSavedAt(new Date());
    toast.success("Attestation questions saved.");
  };

  return (
    <div className="bg-[#f1f1f6] min-h-full">
      <div className="bg-[#f1f1f6] px-[24px] pt-[16px]">
        <div className="flex items-start justify-between mb-[12px]">
          <div>
            <h1 className="text-[22px] font-bold text-[#252a2e] leading-[32px]">Timesheet Settings</h1>
            <p className="text-[11px] text-[#6a6e79] mt-[1px]">Configure daily attestation questions and map them to rest break and meal penalty violations</p>
          </div>
          {savedAt && (
            <ModusWcBadge color="success" size="sm" variant="filled">
              Saved at {savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </ModusWcBadge>
          )}
        </div>
      </div>

      <div className="px-[24px] pb-[32px]" id="attestation-questions">
        <CardShell
          title="Attestation Questions"
          action={
            <ModusWcButton color="primary" variant="filled" size="sm" onButtonClick={addQuestion}>
              <ModusWcIcon name="add" size="xs" decorative />
              Add Question
            </ModusWcButton>
          }
        >
          <div className="px-[20px] pt-[14px] pb-[6px] flex flex-col gap-[12px]">
            <p className="text-[12px] text-[#464b52] leading-[18px]">
              Questions cannot be changed after they are created in order to keep the integrity of the answers associated with them.
              Invalid answers will be flagged on the timesheet summary. Map invalid answers to associated rest break or meal violations to trigger the corresponding premium pay rule.
            </p>
            {!penaltyViolationSelectable && (
              <ModusWcAlert
                variant="info"
                alertTitle="Violation penalty mapping unavailable"
                alertDescription="Select Meal penalty as the break type and enable at least one rest break or meal violation under Timesheet Hour Rules before mapping attestation questions."
              />
            )}
          </div>

          <div className="px-[20px] pt-[8px] pb-[4px]">
            <div className="overflow-x-auto rounded-[6px] border border-[#e0e1e9]">
              <table className="w-full border-collapse min-w-[960px] text-[12px]">
                <thead>
                  <tr className="bg-[#f5f5f8]">
                    <th className="border-b border-[#e0e1e9] px-[12px] py-[8px] text-left text-[12px] font-semibold text-[#6a6e79] min-w-[240px]">Question</th>
                    <th className="border-b border-[#e0e1e9] px-[12px] py-[8px] text-left text-[12px] font-semibold text-[#6a6e79] w-[150px]">Valid Answer</th>
                    <th className="border-b border-[#e0e1e9] px-[12px] py-[8px] text-left text-[12px] font-semibold text-[#6a6e79] w-[150px]">Require Comment</th>
                    <th className="border-b border-[#e0e1e9] px-[12px] py-[8px] text-left text-[12px] font-semibold text-[#6a6e79] w-[210px]">Require Comment on Invalid Answer</th>
                    <th className="border-b border-[#e0e1e9] px-[12px] py-[8px] text-center text-[12px] font-semibold text-[#6a6e79] w-[120px]">Safety Related</th>
                    <th className="border-b border-[#e0e1e9] px-[12px] py-[8px] text-left text-[12px] font-semibold text-[#6a6e79] w-[200px]">Penalty Trigger</th>
                    <th className="border-b border-[#e0e1e9] px-[12px] py-[8px] text-center text-[12px] font-semibold text-[#6a6e79] w-[60px]" />
                  </tr>
                </thead>
                <tbody>
                  {draftQuestions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="border-b border-[#e0e1e9] px-[12px] py-[24px] text-center text-[12px] text-[#6a6e79]">
                        No attestation questions yet. Click &quot;Add Question&quot; to create one.
                      </td>
                    </tr>
                  )}
                  {draftQuestions.map((q, idx) => (
                    <tr key={q.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}>
                      <td className="border-b border-[#e0e1e9] px-[12px] py-[10px]">
                        {q.persisted ? (
                          <span className="text-[12px] font-medium text-[#252a2e]">{q.question}</span>
                        ) : (
                          <ModusWcTextInput
                            aria-label="Question text"
                            size="sm"
                            placeholder="Enter attestation question…"
                            value={q.question}
                            onInputChange={(e) => updateQuestion(q.id, { question: e.target.value })}
                          />
                        )}
                      </td>
                      <td className="border-b border-[#e0e1e9] px-[12px] py-[10px]">
                        <AttestationValidAnswerToggle
                          value={q.validAnswer}
                          onChange={(v) => updateQuestion(q.id, { validAnswer: v })}
                        />
                      </td>
                      <td className="border-b border-[#e0e1e9] px-[12px] py-[10px]">
                        <AttestationYesNoToggle
                          value={q.requireComment}
                          onChange={(v) => updateQuestion(q.id, { requireComment: v })}
                          ariaLabel="Require comment"
                        />
                      </td>
                      <td className="border-b border-[#e0e1e9] px-[12px] py-[10px]">
                        <AttestationYesNoToggle
                          value={q.requireCommentOnInvalid}
                          onChange={(v) => updateQuestion(q.id, { requireCommentOnInvalid: v })}
                          ariaLabel="Require comment on invalid answer"
                        />
                      </td>
                      <td className="border-b border-[#e0e1e9] px-[12px] py-[10px] text-center">
                        <ModusWcCheckbox
                          aria-label={`Safety related: ${q.question || "new question"}`}
                          size="sm"
                          value={q.safetyRelated}
                          onInputChange={(e) => {
                            const next = Boolean(
                              (e as CustomEvent<{ target?: { checked?: boolean } }>).detail?.target?.checked
                                ?? !q.safetyRelated,
                            );
                            updateQuestion(q.id, { safetyRelated: next });
                          }}
                        />
                      </td>
                      <td className="border-b border-[#e0e1e9] px-[12px] py-[10px]">
                        {penaltyViolationSelectable ? (
                          <SelectField
                            value={q.violationId}
                            onChange={(v) => updateQuestion(q.id, { violationId: v })}
                            placeholder="None"
                            options={violationOptions}
                          />
                        ) : (
                          <div className="flex flex-col gap-[2px] min-w-0">
                            <span className="text-[12px] font-medium text-[#6a6e79]">Not available</span>
                            <span className="text-[11px] text-[#a3a3a3] leading-[15px]">
                              Configure violation penalties in Timesheet Hour Rules to enable mapping.
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="border-b border-[#e0e1e9] px-[12px] py-[10px] text-center">
                        <ModusWcButton
                          color="danger"
                          variant="filled"
                          size="sm"
                          shape="square"
                          aria-label={`Delete question: ${q.question || "new question"}`}
                          onButtonClick={() => removeQuestion(q.id)}
                        >
                          <Trash2 size={14} />
                        </ModusWcButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-end px-[20px] py-[16px] border-t border-[#f0f0f4] mt-[12px]">
            <ModusWcButton color="primary" variant="filled" size="sm" onButtonClick={handleSave}>
              <Save size={14} />
              Save Questions
            </ModusWcButton>
          </div>
        </CardShell>
      </div>
    </div>
  );
}

// ─── Root Settings Page ───────────────────────────────────────────────────────
function JurisdictionSettings({ onOpenAttestationQuestions }: { onOpenAttestationQuestions?: () => void }) {
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
            <h1 className="text-[22px] font-bold text-[#252a2e] leading-[32px]">Timesheet Hour Rules</h1>
            <p className="text-[11px] text-[#6a6e79] mt-[1px]">Configure hour rules, meal periods, break policies, and meal penalties by jurisdiction</p>
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
        {activeTab === "hour" && (
          <HourRulesTab onSave={scheduleAutosave} onOpenAttestationQuestions={onOpenAttestationQuestions} />
        )}
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
  | "s_tenant_images" | "s_hour_rules" | "s_timesheet_settings" | "s_rate_level" | "s_auto_job";

const SETTINGS_PAGES = new Set<NavPage>([
  "s_settings","s_permissions","s_time_off_setup","s_notifications",
  "s_tenant_images","s_hour_rules","s_timesheet_settings","s_rate_level","s_auto_job",
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

const STATE_STYLE: Record<BreakState, { label: string; color: string; bg: string; border: string }> = {
  upcoming:  { label: "Upcoming",  color: "#0063a3", bg: "#e8f2fa", border: "#a3cced" },
  missed:    { label: "Missed",    color: "#ab1f26", bg: "#faeaea", border: "#eeb4b7" },
  late:      { label: "Late",      color: "#a35b06", bg: "#fef3e2", border: "#f2ce8f" },
  compliant: { label: "On time",   color: "#15803d", bg: "#e8f7ed", border: "#a8dcbb" },
};

// An employee who has not clocked a break is who a foreman can still act on.
const hasNotStartedBreak = (e: BreakEmployee) => e.state === "upcoming" || e.state === "missed";

const OS = "var(--modus-wc-font-family), sans-serif";
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

function StyledCheckbox({ checked, onChange, indeterminate, ariaLabel }: {
  checked: boolean; onChange: () => void; indeterminate?: boolean; ariaLabel?: string;
}) {
  return (
    <ModusWcCheckbox
      aria-label={ariaLabel ?? "Select row"}
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
type WaiverFilter = "all" | "assigned" | "unassigned";

const PAGE_SIZE = 8;

// Each filter carries its own semantic color so the counts read at a glance.
const FILTER_STYLES: Record<WaiverFilter, {
  tint: string; border: string; text: string;
  badgeOn: string; badgeOnText: string; badgeOff: string; badgeOffText: string;
}> = {
  all:        { tint: "#e8f2fa", border: "#0063a3", text: "#0e416c", badgeOn: "#0063a3", badgeOnText: "#ffffff", badgeOff: "#cfe4f4", badgeOffText: "#0e416c" },
  assigned:   { tint: "#e8f7ed", border: "#16a34a", text: "#15803d", badgeOn: "#16a34a", badgeOnText: "#ffffff", badgeOff: "#cbeed8", badgeOffText: "#15803d" },
  unassigned: { tint: "#f1f1f6", border: "#6a6e79", text: "#464b52", badgeOn: "#6a6e79", badgeOnText: "#ffffff", badgeOff: "#e0e1e9", badgeOffText: "#464b52" },
};

function OnDutyEmployeeModal({ selected, initialFilter, onApply, onClose }: {
  selected: string[];
  initialFilter: WaiverFilter;
  onApply: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<WaiverFilter>(initialFilter);
  const [query, setQuery] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [department, setDepartment] = useState("");
  const [title, setTitle] = useState("");
  const [page, setPage] = useState(0);
  const [draft, setDraft] = useState<string[]>(selected);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sortedUnique = (pick: (e: OnDutyEmployee) => string) =>
    [...new Set(ON_DUTY_ROSTER.map(pick))].sort();

  // Attribute filters narrow the population; the waiver tabs then split that
  // population by assignment, so the tab counts stay true to what is listed.
  const scoped = ON_DUTY_ROSTER.filter((e) => {
    if (costCenter && e.costCenter !== costCenter) return false;
    if (department && e.department !== department) return false;
    if (title && e.title !== title) return false;
    const q = query.trim().toLowerCase();
    return !q || e.name.toLowerCase().includes(q) || e.title.toLowerCase().includes(q);
  });

  const matches = scoped.filter((e) => {
    if (filter === "assigned" && !draft.includes(e.id)) return false;
    if (filter === "unassigned" && draft.includes(e.id)) return false;
    return true;
  });

  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = matches.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const setFilterAndReset = (f: WaiverFilter) => { setFilter(f); setPage(0); };
  const toggle = (id: string) =>
    setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  const scopedAssigned = scoped.filter((e) => draft.includes(e.id)).length;
  const hasAttributeFilter = Boolean(costCenter || department || title);
  const clearAttributeFilters = () => {
    setCostCenter(""); setDepartment(""); setTitle(""); setPage(0);
  };

  const tabs: { value: WaiverFilter; label: string; count: number }[] = [
    { value: "all",        label: "All",          count: scoped.length },
    { value: "assigned",   label: "Assigned",     count: scopedAssigned },
    { value: "unassigned", label: "Not assigned", count: scoped.length - scopedAssigned },
  ];

  const th = "px-[16px] py-[10px] text-left text-[11px] font-semibold uppercase tracking-[0.4px] text-[#6a6e79]";
  const td = "px-[16px] py-[11px] text-[13px] text-[#252a2e] align-middle";

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 200, background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="On-duty meal employees"
        className="bg-white rounded-[10px] shadow-[0_8px_40px_rgba(0,0,0,0.18)] flex flex-col"
        style={{ width: 820, maxHeight: "88vh", overflow: "hidden" }}>
        {/* Header */}
        <div className="flex items-start justify-between px-[24px] py-[18px]" style={{ borderBottom: "1px solid #e0e1e9" }}>
          <div>
            <p className="text-[18px] font-semibold text-[#252a2e]">On-Duty Meal Employees</p>
            <p className="text-[12px] text-[#6a6e79] mt-[2px]">
              Assign the on-duty meal waiver to the employees allowed to record one.
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
              placeholder="Search name or title"
              value={query}
              onInputChange={(e) => { setQuery(e.target.value); setPage(0); }}
              onClearClick={() => { setQuery(""); setPage(0); }}
            />
          </div>
        </div>

        {/* Attribute filters */}
        <div className="flex items-end gap-[12px] px-[24px] pb-[16px]">
          <FilterInput
            placeholder="Cost Center"
            value={costCenter}
            onChange={(v) => { setCostCenter(v); setPage(0); }}
            options={sortedUnique((e) => e.costCenter)}
          />
          <FilterInput
            placeholder="Department"
            value={department}
            onChange={(v) => { setDepartment(v); setPage(0); }}
            options={sortedUnique((e) => e.department)}
          />
          <FilterInput
            placeholder="Title"
            value={title}
            onChange={(v) => { setTitle(v); setPage(0); }}
            options={sortedUnique((e) => e.title)}
          />
          <div className="shrink-0" style={{ visibility: hasAttributeFilter ? "visible" : "hidden" }}>
            <ModusWcButton color="primary" variant="borderless" size="sm" onButtonClick={clearAttributeFilters}>
              Clear filters
            </ModusWcButton>
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
                  <th className={th}>Department</th>
                  <th className={th} style={{ textAlign: "right" }}>Waiver</th>
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
                        <span className="block text-[11px] text-[#6a6e79]">{e.title}</span>
                      </td>
                      <td className={td}>
                        <span className="text-[12px]">{e.department}</span>
                        <span className="block text-[11px] text-[#6a6e79]">{e.costCenter}</span>
                      </td>
                      <td className={td} style={{ textAlign: "right" }}>
                        {assigned ? (
                          <span className="inline-flex items-center gap-[6px] text-[12px] text-[#15803d]">
                            <Check size={13} /> Assigned
                          </span>
                        ) : (
                          <span className="text-[12px] text-[#6a6e79]">Not assigned</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr style={{ borderTop: "1px solid #e0e1e9" }}>
                    <td colSpan={4} className="px-[16px] py-[28px] text-center text-[13px] text-[#6a6e79]">
                      No employees match these filters.
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
            {draft.length} of {ON_DUTY_ROSTER.length} employees assigned
          </span>
          <ModusWcButton color="primary" variant="filled" size="sm"
            onButtonClick={() => { onApply(draft); onClose(); }}>
            Save
          </ModusWcButton>
        </div>
      </div>
    </div>
  );
}

// ─── Attestation Modal ────────────────────────────────────────────────────────
type AttestationAnswerState = Record<string, { answer: AttestationAnswer | null; comment: string }>;

function attestationCommentRequired(q: AttestationQuestion, answer: AttestationAnswer | null): boolean {
  if (!answer) return false;
  if (q.requireComment) return true;
  if (q.requireCommentOnInvalid && answer !== q.validAnswer) return true;
  return false;
}

function attestationCanSubmit(questions: AttestationQuestion[], answers: AttestationAnswerState): boolean {
  if (questions.length === 0) return false;
  return questions.every((q) => {
    const entry = answers[q.id];
    if (!entry?.answer) return false;
    if (attestationCommentRequired(q, entry.answer) && !entry.comment.trim()) return false;
    return true;
  });
}

function AttestationModal({ day, onClose, onSubmit }: {
  day: { label: string; date: number };
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { questions } = useAttestationConfig();
  const [answers, setAnswers] = useState<AttestationAnswerState>(() =>
    Object.fromEntries(questions.map((q) => [q.id, { answer: null, comment: "" }]))
  );

  const dateStr = `Tue 2026/07/${day.date}`;
  const canSubmit = attestationCanSubmit(questions, answers);

  const setAnswer = (id: string, answer: AttestationAnswer) => {
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], answer } }));
  };

  const setComment = (id: string, comment: string) => {
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], comment } }));
  };

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
          <ModusWcSelect
            aria-label="Attestation date"
            value={dateStr}
            options={[{ label: dateStr, value: dateStr }]}
          />

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

          {questions.map((q) => {
            const entry = answers[q.id] ?? { answer: null, comment: "" };
            const commentNeeded = attestationCommentRequired(q, entry.answer);
            return (
              <div key={q.id}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS, marginBottom: 10 }}>
                  {q.question} <span style={{ color: "#ab1f26" }}>*</span>
                </p>
                <div className="flex flex-col rounded-[6px] overflow-hidden" style={{ border: "1px solid #e0e1e9" }}>
                  <RadioRow label="Yes" selected={entry.answer === "yes"} onSelect={() => setAnswer(q.id, "yes")} />
                  <div style={{ height: 1, background: "#e0e1e9" }} />
                  <RadioRow label="No" selected={entry.answer === "no"} onSelect={() => setAnswer(q.id, "no")} />
                </div>
                <div className="mt-[10px]">
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#252a2e", fontFamily: OS, ...OS_FVS, marginBottom: 4 }}>
                    Additional Comments {commentNeeded && <span style={{ color: "#ab1f26" }}>*</span>}
                  </p>
                  <ModusWcTextInput
                    aria-label={`Additional comments for: ${q.question}`}
                    value={entry.comment}
                    required={commentNeeded}
                    feedback={commentNeeded && !entry.comment.trim() ? { level: "error", message: "A comment is required." } : undefined}
                    onInputChange={(e) => setComment(q.id, e.target.value)}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-[10px] px-[24px] py-[16px]" style={{ borderTop: "1px solid #e0e1e9" }}>
          <button type="button" onClick={onClose}
            className="px-[20px] py-[9px] rounded-[6px] font-semibold transition-colors"
            style={{ background: "#ffffff", border: "1px solid #e0e1e9", color: "#464b52", fontSize: 14, fontFamily: OS, ...OS_FVS, cursor: "pointer" }}>
            Cancel
          </button>
          <button type="button"
            onClick={() => { if (canSubmit) { onSubmit(); onClose(); } }}
            disabled={!canSubmit}
            className="px-[20px] py-[9px] rounded-[6px] font-semibold transition-colors"
            style={{
              background: canSubmit ? "#0063a3" : "#cbced4",
              color: "#ffffff",
              border: "none",
              fontSize: 14,
              fontFamily: OS,
              ...OS_FVS,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}>
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Attestation Panel ────────────────────────────────────────────────────────
function AttestationPanel({ days, attested, onAttest }: {
  days: { label: string; date: number }[];
  attested: Set<number>;
  onAttest: (date: number) => void;
}) {
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
            onAttest(activeDay.date);
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

type ClockTimesheetEntry = (typeof CLOCK_MOCK_ENTRIES)[number];

type TimesheetPunchPin = {
  site: JobSite;
  fix: GeoFix;
  title: string;
  flagged?: boolean;
};

type TimesheetBreakMealRow = {
  start: string;
  end: string | null;
  startLoc?: TimesheetPunchPin;
  endLoc?: TimesheetPunchPin;
};

const MOBILE_CARD: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 12,
  border: "1px solid #e0e1e9",
  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
};

const fmtTsHours = (n: number) => (n > 0 ? n.toFixed(2) : "—");
const fmtTsQty = (n: number) => (n > 0 ? String(n) : "—");
const fmtTsPerDiem = (n: number) => (n > 0 ? `$${n}` : "—");

function TimesheetMobileKvRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-[12px]" style={{ marginBottom: 6 }}>
      <p style={{ fontSize: 11, color: "#6a6e79", fontFamily: OS, ...OS_FVS, flexShrink: 0 }}>{label}</p>
      <p style={{
        fontSize: 12, fontWeight: 600, color: valueColor ?? "#252a2e", fontFamily: OS, ...OS_FVS,
        textAlign: "right", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {value}
      </p>
    </div>
  );
}

function TimesheetMobileEntryCard({
  entry,
  onOpenMap,
}: {
  entry: EnrichedTimesheetEntry;
  onOpenMap: (pin: TimesheetPunchPin) => void;
}) {
  const isBreak = entry.phase === "Break";
  return (
    <div style={{
      ...MOBILE_CARD,
      overflow: "hidden",
      borderColor: isBreak ? "#fde68a" : "#e0e1e9",
      background: isBreak ? "#fffbeb" : "#ffffff",
    }}>
      <div className="flex items-center gap-[8px]" style={{ padding: "10px 14px", borderBottom: `1px solid ${isBreak ? "#fde68a" : "#eef0f3"}` }}>
        <Calendar size={14} style={{ color: isBreak ? "#d97706" : "#6a6e79", flexShrink: 0 }} />
        <p style={{ fontSize: 12, fontWeight: 700, color: isBreak ? "#92400e" : "#252a2e", fontFamily: OS, ...OS_FVS, flex: 1 }}>
          {entry.date}
        </p>
        {isBreak && (
          <span style={{ fontSize: 10, fontWeight: 700, color: "#92400e", background: "#fde68a", borderRadius: 4, padding: "2px 6px", fontFamily: OS }}>
            Break
          </span>
        )}
      </div>
      <div style={{ padding: "10px 14px 12px" }}>
        <TimesheetMobileKvRow label="Job #" value={entry.jobNum} valueColor={isBreak ? "#92400e" : undefined} />
        <div className="flex items-start justify-between gap-[12px]" style={{ marginBottom: 6 }}>
          <p style={{ fontSize: 11, color: "#6a6e79", fontFamily: OS, ...OS_FVS, flexShrink: 0 }}>Start</p>
          <div className="text-right">
            <p style={{ fontSize: 12, fontWeight: 600, color: isBreak ? "#92400e" : "#252a2e", fontFamily: OS, ...OS_FVS }}>{entry.start}</p>
            <TimesheetMapButton pin={entry.clockInLoc} onOpen={onOpenMap} />
          </div>
        </div>
        <div className="flex items-start justify-between gap-[12px]" style={{ marginBottom: 6 }}>
          <p style={{ fontSize: 11, color: "#6a6e79", fontFamily: OS, ...OS_FVS, flexShrink: 0 }}>End</p>
          <div className="text-right">
            <p style={{ fontSize: 12, fontWeight: 600, color: isBreak ? "#92400e" : "#252a2e", fontFamily: OS, ...OS_FVS }}>{entry.end}</p>
            <TimesheetMapButton pin={entry.clockOutLoc} onOpen={onOpenMap} />
          </div>
        </div>
        {!isBreak && (
          <>
            <TimesheetMobileKvRow label="Dept" value={entry.dept} />
            <TimesheetMobileKvRow label="Job" value={entry.job} />
            <TimesheetMobileKvRow label="Phase" value={entry.phase} />
            <TimesheetMobileKvRow label="Rule" value={entry.payRule} />
            <div className="grid grid-cols-2 gap-x-[16px] mt-[4px] pt-[8px]" style={{ borderTop: "1px dashed #e0e1e9" }}>
              <TimesheetMobileKvRow label="Reg" value={fmtTsHours(entry.reg)} />
              <TimesheetMobileKvRow label="OT" value={fmtTsHours(entry.ot)} valueColor={entry.ot > 0 ? "#0063a3" : undefined} />
              <TimesheetMobileKvRow label="OT2" value={fmtTsHours(entry.ot2)} />
              <TimesheetMobileKvRow label="Qty" value={fmtTsQty(entry.qty)} />
              <TimesheetMobileKvRow label="Travel" value={fmtTsHours(entry.travel)} />
              <TimesheetMobileKvRow label="Per Diem" value={fmtTsPerDiem(entry.perDiem)} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TimesheetMobileBreakCard({
  date, start, end, startLoc, endLoc, onOpenMap,
}: {
  date: string;
  start: string;
  end: string | null;
  startLoc?: TimesheetPunchPin;
  endLoc?: TimesheetPunchPin;
  onOpenMap: (pin: TimesheetPunchPin) => void;
}) {
  return (
    <div style={{ ...MOBILE_CARD, overflow: "hidden", borderColor: "#fde68a", background: "#fffbeb" }}>
      <div className="flex items-center gap-[8px]" style={{ padding: "10px 14px", borderBottom: "1px solid #fde68a" }}>
        <Calendar size={14} style={{ color: "#d97706", flexShrink: 0 }} />
        <p style={{ fontSize: 12, fontWeight: 700, color: "#92400e", fontFamily: OS, ...OS_FVS, flex: 1 }}>{date}</p>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#92400e", background: "#fde68a", borderRadius: 4, padding: "2px 6px", fontFamily: OS }}>Break</span>
      </div>
      <div style={{ padding: "10px 14px 12px" }}>
        <div className="flex items-start justify-between gap-[12px]" style={{ marginBottom: 6 }}>
          <p style={{ fontSize: 11, color: "#6a6e79", fontFamily: OS, ...OS_FVS, flexShrink: 0 }}>Start</p>
          <div className="text-right">
            <p style={{ fontSize: 12, fontWeight: 600, color: "#92400e", fontFamily: OS, ...OS_FVS }}>{start}</p>
            <TimesheetMapButton pin={startLoc} onOpen={onOpenMap} />
          </div>
        </div>
        <div className="flex items-start justify-between gap-[12px]" style={{ marginBottom: 6 }}>
          <p style={{ fontSize: 11, color: "#6a6e79", fontFamily: OS, ...OS_FVS, flexShrink: 0 }}>End</p>
          <div className="text-right">
            <p style={{ fontSize: 12, fontWeight: 600, color: "#92400e", fontFamily: OS, ...OS_FVS }}>{end ?? "—"}</p>
            {end && <TimesheetMapButton pin={endLoc} onOpen={onOpenMap} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimesheetMobileMealCard({
  date, start, end, startLoc, endLoc, onOpenMap,
}: {
  date: string;
  start: string;
  end: string | null;
  startLoc?: TimesheetPunchPin;
  endLoc?: TimesheetPunchPin;
  onOpenMap: (pin: TimesheetPunchPin) => void;
}) {
  return (
    <div style={{ ...MOBILE_CARD, overflow: "hidden", borderColor: "#bbe6ca", background: "#f2fbf5" }}>
      <div className="flex items-center gap-[8px]" style={{ padding: "10px 14px", borderBottom: "1px solid #bbe6ca" }}>
        <Calendar size={14} style={{ color: "#15803d", flexShrink: 0 }} />
        <p style={{ fontSize: 12, fontWeight: 700, color: "#15803d", fontFamily: OS, ...OS_FVS, flex: 1 }}>{date}</p>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#15803d", background: "#cdecd8", borderRadius: 4, padding: "2px 6px", fontFamily: OS }}>On-duty meal</span>
      </div>
      <div style={{ padding: "10px 14px 12px" }}>
        <div className="flex items-start justify-between gap-[12px]" style={{ marginBottom: 6 }}>
          <p style={{ fontSize: 11, color: "#6a6e79", fontFamily: OS, ...OS_FVS, flexShrink: 0 }}>Start</p>
          <div className="text-right">
            <p style={{ fontSize: 12, fontWeight: 600, color: "#15803d", fontFamily: OS, ...OS_FVS }}>{start}</p>
            <TimesheetMapButton pin={startLoc} onOpen={onOpenMap} />
          </div>
        </div>
        <div className="flex items-start justify-between gap-[12px]" style={{ marginBottom: 6 }}>
          <p style={{ fontSize: 11, color: "#6a6e79", fontFamily: OS, ...OS_FVS, flexShrink: 0 }}>End</p>
          <div className="text-right">
            <p style={{ fontSize: 12, fontWeight: 600, color: "#15803d", fontFamily: OS, ...OS_FVS }}>{end ?? "—"}</p>
            {end && <TimesheetMapButton pin={endLoc} onOpen={onOpenMap} />}
          </div>
        </div>
        <p style={{ fontSize: 11, color: "#3f7d55", fontFamily: OS, ...OS_FVS, marginTop: 4 }}>Paid — counts toward hours</p>
      </div>
    </div>
  );
}

function MobileTimesheetSection({
  breakRows,
  mealRows,
  todayLabel,
  onOpenMap,
}: {
  breakRows: TimesheetBreakMealRow[];
  mealRows: TimesheetBreakMealRow[];
  todayLabel: string;
  onOpenMap: (pin: TimesheetPunchPin) => void;
}) {
  const entries = getMockTimesheetEntries();
  const totalReg = entries.reduce((s, e) => s + e.reg, 0);
  const totalOT = entries.reduce((s, e) => s + e.ot, 0);
  const totalTravel = entries.reduce((s, e) => s + e.travel, 0);

  return (
    <div className="mt-[16px] mb-[16px]">
      <div className="rounded-[10px] overflow-hidden" style={{ border: "1px solid #e0e1e9" }}>
        <div style={{ padding: "12px 14px", background: "#0e416c" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#ffffff", fontFamily: OS, ...OS_FVS }}>
            Timesheet for Pay Period August 1 – August 7, 2026
          </p>
        </div>
        <div className="flex flex-col gap-[10px]" style={{ padding: "12px", background: "#f7f7f8" }}>
          {entries.map((entry, i) => (
            <TimesheetMobileEntryCard key={`${entry.date}-${entry.start}-${i}`} entry={entry} onOpenMap={onOpenMap} />
          ))}
          {breakRows.map((br, i) => (
            <TimesheetMobileBreakCard
              key={`break-${i}`}
              date={todayLabel}
              start={br.start}
              end={br.end}
              startLoc={br.startLoc}
              endLoc={br.endLoc}
              onOpenMap={onOpenMap}
            />
          ))}
          {mealRows.map((mr, i) => (
            <TimesheetMobileMealCard
              key={`meal-${i}`}
              date={todayLabel}
              start={mr.start}
              end={mr.end}
              startLoc={mr.startLoc}
              endLoc={mr.endLoc}
              onOpenMap={onOpenMap}
            />
          ))}
          <div style={{ ...MOBILE_CARD, padding: "12px 14px", background: "#f1f1f6", borderColor: "#cbced4" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS, marginBottom: 8 }}>Totals</p>
            <div className="grid grid-cols-2 gap-x-[16px]">
              <TimesheetMobileKvRow label="Reg" value={totalReg.toFixed(2)} />
              <TimesheetMobileKvRow label="OT" value={totalOT.toFixed(2)} valueColor="#0063a3" />
              <TimesheetMobileKvRow label="Travel" value={totalTravel.toFixed(2)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Days awaiting attestation, shared by the desktop panel and the mobile card.
const ATTESTATION_DAYS = [
  { label: "Tue", date: 22 },
  { label: "Wed", date: 23 },
  { label: "Thu", date: 24 },
  { label: "Mon", date: 28 },
];

/*
  An on-duty meal is its own state rather than a flavour of break: the employee
  eats without leaving the job, stays clocked in, and is paid for the time,
  which is what the signed on-duty meal agreement covers.
*/
type ClockState = "out" | "in" | "break" | "meal";

const ON_DUTY_AGREEMENT_SIGNED = "Feb 9, 2026";

/*
  Each job carries the geofence its crew is expected to clock in from. A fix
  outside the radius does not block the punch; it is recorded on the entry so a
  supervisor can review why the crew was somewhere else.
*/
type JobSite = { name: string; address: string; lat: number; lng: number; radiusMeters: number };

const JOB_SITES: Record<string, JobSite> = {
  "003699 - AEP Carrollton Sub": { name: "AEP Carrollton Substation", address: "1720 Kelly Blvd, Carrollton, TX", lat: 32.9857, lng: -96.8903, radiusMeters: 150 },
  "003700 - Job B":              { name: "Richardson Yard",           address: "500 Lookout Dr, Richardson, TX", lat: 32.9718, lng: -96.7299, radiusMeters: 200 },
  "003701 - Job C":              { name: "Plano Transfer Station",    address: "4200 W Plano Pkwy, Plano, TX",   lat: 33.0198, lng: -96.7469, radiusMeters: 120 },
};

// Shared by the desktop form and the mobile sheet so the two cannot drift.
const CLOCK_CREW_OPTIONS  = ["740 - Adam Hazey's Crew", "Crew B", "Crew C"];
const CLOCK_DEPT_OPTIONS  = ["3300 - Job Cost", "3400 - Operations", "3500 - Admin"];
const CLOCK_JOB_OPTIONS   = Object.keys(JOB_SITES);
const CLOCK_PHASE_OPTIONS = ["5554 - Renewal - Asphalt", "5555 - Phase B", "5556 - Phase C"];

type GeoFix = { lat: number; lng: number; accuracyMeters: number };

// Straight-line ground distance; accurate enough at geofence scale.
const distanceMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const formatDistance = (meters: number) =>
  meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1609.34).toFixed(1)} mi`;

const formatCoords = (fix: GeoFix) =>
  `${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}`;

/*
  Real geolocation would place a demo device thousands of miles from these mock
  sites, so the fix is derived from the selected job. The off-site offset is
  roughly 2 km, far enough to fail every radius above.
*/
const simulateFix = (site: JobSite, offSite: boolean): GeoFix =>
  offSite
    ? { lat: site.lat + 0.0180, lng: site.lng - 0.0075, accuracyMeters: 22 }
    : { lat: site.lat + 0.0004, lng: site.lng + 0.0003, accuracyMeters: 8 };

const timesheetPunchPin = (jobKey: string, offSite: boolean, title: string): TimesheetPunchPin | undefined => {
  const jobSite = JOB_SITES[jobKey];
  if (!jobSite) return undefined;
  return { site: jobSite, fix: simulateFix(jobSite, offSite), title, flagged: offSite };
};

const mockEntryLocations = (entry: ClockTimesheetEntry): {
  clockInLoc?: TimesheetPunchPin;
  clockOutLoc?: TimesheetPunchPin;
} => {
  if (!entry.job || entry.job === "—") return {};
  const isBreak = entry.phase === "Break";
  const startTitle = isBreak ? `Break start · ${entry.start}` : `Clock in · ${entry.start}`;
  const endTitle = isBreak ? `Break end · ${entry.end}` : `Clock out · ${entry.end}`;
  const offSiteOut = entry.date === "Thu, Jul 24" && !isBreak;
  return {
    clockInLoc: timesheetPunchPin(entry.job, false, startTitle),
    clockOutLoc: timesheetPunchPin(entry.job, offSiteOut, endTitle),
  };
};

type EnrichedTimesheetEntry = ClockTimesheetEntry & {
  clockInLoc?: TimesheetPunchPin;
  clockOutLoc?: TimesheetPunchPin;
};

const getMockTimesheetEntries = (): EnrichedTimesheetEntry[] =>
  CLOCK_MOCK_ENTRIES.map((entry) => ({ ...entry, ...mockEntryLocations(entry) }));

/*
  Web Mercator, enough of it to lay out OpenStreetMap tiles by hand. A map
  library would pull in a dependency for one read-only view, and drawing the
  tiles ourselves lets the geofence be a real circle at the map's own scale.
*/
const TILE_SIZE = 256;

const lngToWorldX = (lng: number, zoom: number) =>
  ((lng + 180) / 360) * Math.pow(2, zoom) * TILE_SIZE;

const latToWorldY = (lat: number, zoom: number) => {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom) * TILE_SIZE;
};

const metersPerPixel = (lat: number, zoom: number) =>
  (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);

const SCALE_STEPS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

function SiteMap({ site, fix, width, height }: { site: JobSite; fix: GeoFix; width: number; height: number }) {
  const distance = distanceMeters(fix, site);
  const onSite = distance <= site.radiusMeters;
  const accent = onSite ? "#15803d" : "#d97706";

  // Frame the whole geofence and the punch together, with room to breathe.
  const spanMeters = Math.max(site.radiusMeters * 2.6, distance * 2.4, 120);
  let zoom = 19;
  while (zoom > 2 && spanMeters / metersPerPixel(site.lat, zoom) > Math.min(width, height)) zoom--;

  const left = lngToWorldX((site.lng + fix.lng) / 2, zoom) - width / 2;
  const top = latToWorldY((site.lat + fix.lat) / 2, zoom) - height / 2;
  const project = (p: { lat: number; lng: number }) => ({
    x: lngToWorldX(p.lng, zoom) - left,
    y: latToWorldY(p.lat, zoom) - top,
  });

  const sitePt = project(site);
  const fixPt = project(fix);
  const mpp = metersPerPixel(site.lat, zoom);
  const radiusPx = site.radiusMeters / mpp;
  const accuracyPx = Math.max(fix.accuracyMeters / mpp, 5);

  const lastTile = Math.pow(2, zoom) - 1;
  const tiles: { key: string; x: number; y: number; url: string }[] = [];
  for (let tx = Math.floor(left / TILE_SIZE); tx <= Math.floor((left + width) / TILE_SIZE); tx++) {
    for (let ty = Math.floor(top / TILE_SIZE); ty <= Math.floor((top + height) / TILE_SIZE); ty++) {
      if (tx < 0 || ty < 0 || tx > lastTile || ty > lastTile) continue;
      tiles.push({
        key: `${tx}/${ty}`,
        x: tx * TILE_SIZE - left,
        y: ty * TILE_SIZE - top,
        url: `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`,
      });
    }
  }

  const scaleMeters = [...SCALE_STEPS].reverse().find(m => m / mpp <= 96) ?? SCALE_STEPS[0];
  const gapPx = Math.hypot(fixPt.x - sitePt.x, fixPt.y - sitePt.y);

  return (
    <div>
      <div style={{
        position: "relative", width, height, overflow: "hidden",
        borderRadius: 8, border: "1px solid #e0e1e9", background: "#e8eae3",
      }}>
        {tiles.map(t => (
          <img key={t.key} src={t.url} alt="" width={TILE_SIZE} height={TILE_SIZE}
            onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
            style={{ position: "absolute", left: t.x, top: t.y, width: TILE_SIZE, height: TILE_SIZE }} />
        ))}

        {/* Geofence, drawn at the same scale as the tiles underneath it */}
        <div style={{
          position: "absolute", left: sitePt.x - radiusPx, top: sitePt.y - radiusPx,
          width: radiusPx * 2, height: radiusPx * 2, borderRadius: "50%",
          border: `2px solid ${accent}`, background: onSite ? "rgba(21,128,61,0.14)" : "rgba(217,119,6,0.12)",
          pointerEvents: "none",
        }} />

        {/* The walk between the punch and the site is the point of the map */}
        {gapPx > 26 && (
          <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <line x1={sitePt.x} y1={sitePt.y} x2={fixPt.x} y2={fixPt.y}
              stroke={accent} strokeWidth={2} strokeDasharray="5 4" />
          </svg>
        )}

        {/* Job site centre */}
        <div style={{
          position: "absolute", left: sitePt.x - 6, top: sitePt.y - 6, width: 12, height: 12,
          borderRadius: "50%", background: accent, border: "2px solid #ffffff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.35)", pointerEvents: "none",
        }} />

        {/* Where the punch was taken, with its accuracy halo */}
        <div style={{
          position: "absolute", left: fixPt.x - accuracyPx, top: fixPt.y - accuracyPx,
          width: accuracyPx * 2, height: accuracyPx * 2, borderRadius: "50%",
          background: "rgba(0,99,163,0.22)", border: "1px solid rgba(0,99,163,0.55)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", left: fixPt.x - 6, top: fixPt.y - 6, width: 12, height: 12,
          borderRadius: "50%", background: "#0063a3", border: "2px solid #ffffff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.35)", pointerEvents: "none",
        }} />

        {/* Scale bar keeps the geofence circle honest */}
        <div style={{ position: "absolute", left: 8, bottom: 8, pointerEvents: "none" }}>
          <div style={{ width: scaleMeters / mpp, height: 4, background: "rgba(37,42,46,0.75)", borderRadius: 1 }} />
          <p style={{ fontSize: 10, color: "#252a2e", fontFamily: OS, ...OS_FVS, marginTop: 2, textShadow: "0 0 3px #ffffff" }}>
            {formatDistance(scaleMeters)}
          </p>
        </div>

        <p style={{
          position: "absolute", right: 4, bottom: 2, fontSize: 9, color: "#464b52", fontFamily: OS, ...OS_FVS,
          background: "rgba(255,255,255,0.72)", borderRadius: 3, padding: "0 4px", pointerEvents: "none",
        }}>
          © OpenStreetMap
        </p>
      </div>

      <div className="flex items-center gap-[16px] mt-[10px]">
        <div className="flex items-center gap-[6px]">
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: accent, border: "2px solid #ffffff", boxShadow: "0 0 0 1px #cbced4" }} />
          <p style={{ fontSize: 11, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>Job site · {site.radiusMeters} m radius</p>
        </div>
        <div className="flex items-center gap-[6px]">
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#0063a3", border: "2px solid #ffffff", boxShadow: "0 0 0 1px #cbced4" }} />
          <p style={{ fontSize: 11, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>You · ±{fix.accuracyMeters} m</p>
        </div>
      </div>
    </div>
  );
}

function TimesheetMapButton({ pin, onOpen }: { pin?: TimesheetPunchPin; onOpen: (pin: TimesheetPunchPin) => void }) {
  if (!pin) return null;
  return (
    <button
      type="button"
      onClick={() => onOpen(pin)}
      aria-label={`View map for ${pin.title}`}
      className="inline-flex items-center gap-[3px]"
      style={{
        marginTop: 3, padding: "1px 6px", fontSize: 10, fontWeight: 700, color: "#0063a3",
        background: "#e8f2fa", border: "1px solid #b3d4ea", borderRadius: 4, cursor: "pointer", fontFamily: OS,
      }}
    >
      <MapPin size={10} />
      Map
    </button>
  );
}

function PunchLocationModalContent({
  pin,
  mapWidth,
  mapHeight,
  onClose,
  closeLabel = "Close",
  layout = "desktop",
}: {
  pin: TimesheetPunchPin;
  mapWidth: number;
  mapHeight: number;
  onClose: () => void;
  closeLabel?: string;
  layout?: "mobile" | "desktop";
}) {
  const dist = distanceMeters(pin.fix, pin.site);
  const onSite = dist <= pin.site.radiusMeters;
  const accent = onSite ? "#15803d" : "#d97706";

  return (
    <>
      <div className="flex items-center gap-[10px] mb-[12px]">
        <div className="flex items-center justify-center shrink-0" style={{ width: 36, height: 36, borderRadius: 999, background: onSite ? "#e8f7ed" : "#fef3e2" }}>
          <MapPin size={18} style={{ color: accent }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 17, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>{pin.title}</p>
          <p style={{ fontSize: 12, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>
            {onSite
              ? `On site · ${pin.site.name} · ${formatDistance(dist)} from center`
              : `${formatDistance(dist)} from ${pin.site.name}`}
            {pin.flagged ? " · flagged for review" : ""}
          </p>
        </div>
      </div>
      <SiteMap site={pin.site} fix={pin.fix} width={mapWidth} height={mapHeight} />
      <p className="mt-[12px]" style={{ fontSize: 12, color: "#464b52", fontFamily: OS, ...OS_FVS, lineHeight: 1.5, marginBottom: layout === "mobile" ? 16 : 24 }}>
        {formatCoords(pin.fix)} · ±{pin.fix.accuracyMeters} m · {pin.site.address}
      </p>
      {layout === "mobile" ? (
        <button type="button" onClick={onClose} className="w-full"
          style={{ background: "#0063a3", color: "#ffffff", border: "none", borderRadius: 8, padding: "13px 0", fontSize: 14, fontWeight: 700, fontFamily: OS, cursor: "pointer" }}>
          {closeLabel}
        </button>
      ) : (
        <div className="flex justify-end">
          <ModusWcButton color="primary" variant="filled" size="md" onButtonClick={onClose}>
            {closeLabel}
          </ModusWcButton>
        </div>
      )}
    </>
  );
}

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

/*
  Desktop and mobile are two renderings of one shift, so the state lives here
  and the page hands the same session to whichever view is on screen. Switching
  views mid-shift keeps the running clock and today's timeline intact.
*/
function useClockSession() {
  const [clocked, setClocked] = useState<ClockState>("out");
  const [elapsed, setElapsed] = useState(0);
  const [breakElapsed, setBreakElapsed] = useState(0);
  const [mealElapsed, setMealElapsed] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [breakStart, setBreakStart] = useState<Date | null>(null);
  const [mealStart, setMealStart] = useState<Date | null>(null);
  const [mealRows, setMealRows] = useState<TimesheetBreakMealRow[]>([]);
  const [showMealModal, setShowMealModal] = useState(false);
  const [mealAck, setMealAck] = useState(false);
  // The shift starts blank: the punch is only as good as the details on it,
  // so nothing is pre-filled for the employee.
  const [crew, setCrew] = useState("");
  const [dept, setDept] = useState("");
  const [job, setJob] = useState("");
  const [phase, setPhase] = useState("");
  const [travel, setTravel] = useState("");
  const [qty, setQty] = useState("");
  const [perDiem, setPerDiem] = useState(false);
  const [comment, setComment] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [timeline, setTimeline] = useState<{
    time: string; label: string; sub: string; color: string;
    location?: string; flagged?: boolean;
  }[]>([]);
  const [locating, setLocating] = useState(true);
  const [offSiteSim, setOffSiteSim] = useState(false);
  const [showOffSiteModal, setShowOffSiteModal] = useState(false);
  const [showSiteMap, setShowSiteMap] = useState(false);
  const [punchMapPin, setPunchMapPin] = useState<TimesheetPunchPin | null>(null);
  const [clockedInOffSite, setClockedInOffSite] = useState(false);
  const [breakRows, setBreakRows] = useState<TimesheetBreakMealRow[]>([]);
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



  // No job picked yet means there is no geofence to measure against.
  const site: JobSite | null = JOB_SITES[job] as JobSite | undefined ?? null;
  const fix = site ? simulateFix(site, offSiteSim) : null;
  const siteDistance = site && fix ? distanceMeters(fix, site) : 0;
  const onSite = !!site && siteDistance <= site.radiusMeters;

  // Job details the punch cannot be recorded without.
  const missingDetails = ([
    ["Job", job], ["Phase", phase], ["Crew", crew], ["Department", dept],
  ] as const).filter(([, value]) => !value).map(([label]) => label);
  const detailsComplete = missingDetails.length === 0;
  const [detailsPrompt, setDetailsPrompt] = useState(false);

  useEffect(() => {
    if (detailsComplete) setDetailsPrompt(false);
  }, [detailsComplete]);

  // Attestations live with the session so a day signed on the phone shows as
  // signed on the desktop, and the other way round.
  const [attested, setAttested] = useState<Set<number>>(new Set());
  const attestDay = (date: number) => setAttested(prev => new Set([...prev, date]));

  // Re-acquire whenever the target site changes, mirroring a device refreshing
  // its fix before the punch is recorded.
  useEffect(() => {
    if (!site) { setLocating(false); return; }
    setLocating(true);
    const id = setTimeout(() => setLocating(false), 900);
    return () => clearTimeout(id);
  }, [job, offSiteSim, site]);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  // Colors per state
  const stateColor = clocked === "out" ? "#0063a3" : clocked === "break" ? "#d97706" : clocked === "meal" ? "#15803d" : "#ab1f26";
  const stateColorLight = clocked === "out" ? "rgba(0,99,163,0.15)" : clocked === "break" ? "rgba(215,119,6,0.15)" : clocked === "meal" ? "rgba(21,128,61,0.15)" : "rgba(171,31,38,0.15)";
  const stateColorMid   = clocked === "out" ? "rgba(0,99,163,0.28)" : clocked === "break" ? "rgba(215,119,6,0.28)" : clocked === "meal" ? "rgba(21,128,61,0.28)" : "rgba(171,31,38,0.28)";
  const stateColorStrong= clocked === "out" ? "rgba(0,99,163,0.50)" : clocked === "break" ? "rgba(215,119,6,0.50)" : clocked === "meal" ? "rgba(21,128,61,0.50)" : "rgba(171,31,38,0.50)";
  const btnLabel = clocked === "out" ? "CLOCK IN" : clocked === "break" ? "END BREAK" : clocked === "meal" ? "END MEAL" : "CLOCK OUT";

  const punchPinFromCurrent = (title: string): TimesheetPunchPin | undefined => {
    if (!site || !fix) return undefined;
    return { site, fix, title, flagged: !onSite };
  };

  const confirmEndBreak = () => {
    const t = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setClocked("in"); setBreakStart(null); setShowEarlyBreakModal(false);
    setTimeline(prev => [{ time: t, label: "Break Ended", sub: `After ${fmt(breakElapsed)}`, color: "#0063a3" }, ...prev]);
    setBreakRows(prev => prev.map((r, i) => i === prev.length - 1 && r.end === null
      ? { ...r, end: t, endLoc: punchPinFromCurrent(`Break end · ${t}`) }
      : r));
  };

  const doClockIn = () => {
    if (!site) return;
    const t = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setClocked("in"); setStartTime(new Date()); setElapsed(0);
    setShowOffSiteModal(false); setClockedInOffSite(!onSite);
    setTimeline(prev => [{
      time: t,
      label: "Clocked In",
      sub: job,
      color: onSite ? "#0063a3" : "#d97706",
      location: onSite
        ? `${site.name} · ${formatDistance(siteDistance)} from site center`
        : `${formatDistance(siteDistance)} from ${site.name}`,
      flagged: !onSite,
    }, ...prev]);
  };

  const handleMainBtn = () => {
    const t = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (clocked === "out") {
      if (!detailsComplete) { setDetailsPrompt(true); setShowForm(true); return; }
      if (locating) return;
      if (!onSite) { setShowOffSiteModal(true); return; }
      doClockIn();
    } else if (clocked === "in") {
      setClocked("out"); setStartTime(null); setElapsed(0); setClockedInOffSite(false);
      setTimeline(prev => [{
        time: t,
        label: "Clocked Out",
        sub: `After ${fmt(elapsed)}`,
        color: "#ab1f26",
        location: site && fix
          ? (onSite ? `${site.name} · ${formatDistance(siteDistance)} from site center` : `${formatDistance(siteDistance)} from ${site.name}`)
          : undefined,
        flagged: site ? !onSite : undefined,
      }, ...prev]);
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
    setMealRows(prev => [...prev, { start: t, end: null, startLoc: punchPinFromCurrent(`On-duty meal start · ${t}`) }]);
  };

  const endOnDutyMeal = () => {
    const t = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setClocked("in"); setMealStart(null);
    setTimeline(prev => [{ time: t, label: "On-Duty Meal Ended", sub: `After ${fmt(mealElapsed)} · paid`, color: "#0063a3" }, ...prev]);
    setMealRows(prev => prev.map((r, i) => i === prev.length - 1 && r.end === null
      ? { ...r, end: t, endLoc: punchPinFromCurrent(`On-duty meal end · ${t}`) }
      : r));
  };

  const handleBreak = () => {
    const t = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setClocked("break"); setBreakStart(new Date()); setBreakElapsed(0);
    setShowBreakAlert(false);
    setTimeline(prev => [{ time: t, label: "Break Started", sub: "Taking a break", color: "#d97706" }, ...prev]);
    setBreakRows(prev => [...prev, { start: t, end: null, startLoc: punchPinFromCurrent(`Break start · ${t}`) }]);
  };

  const [showBreakAlert, setShowBreakAlert] = useState(false);
  const BREAK_INTERVAL = 30; // 30 seconds for testing (change to 30 * 60 for production)

  useEffect(() => {
    if (clocked !== "in") { setShowBreakAlert(false); return; }
    if (elapsed >= BREAK_INTERVAL) setShowBreakAlert(true);
  }, [elapsed, clocked]);

  const breakRemaining = Math.max(0, MANDATORY_BREAK - breakElapsed);
  const breakRemainingFmt = `${Math.floor(breakRemaining / 60)}:${(breakRemaining % 60).toString().padStart(2, "0")}`;

  return {
    clocked, setClocked, elapsed, setElapsed, breakElapsed, setBreakElapsed, mealElapsed,
    startTime, setStartTime, setBreakStart,
    mealRows, breakRows, timeline,
    showMealModal, setShowMealModal, mealAck, setMealAck,
    showEarlyBreakModal, setShowEarlyBreakModal, showBreakAlert,
    showOffSiteModal, setShowOffSiteModal,
    showSiteMap, setShowSiteMap,
    punchMapPin, setPunchMapPin,
    crew, setCrew, dept, setDept, job, setJob, phase, setPhase,
    travel, setTravel, qty, setQty, perDiem, setPerDiem, comment, setComment,
    showForm, setShowForm,
    locating, offSiteSim, setOffSiteSim, clockedInOffSite,
    site, fix, siteDistance, onSite,
    missingDetails, detailsComplete, detailsPrompt, setDetailsPrompt,
    attested, attestDay,
    fmt, stateColor, stateColorLight, stateColorMid, stateColorStrong, btnLabel,
    breakRemainingFmt,
    handleMainBtn, doClockIn, confirmEndBreak, handleBreak, startOnDutyMeal,
  };
}

type ClockSession = ReturnType<typeof useClockSession>;

// Both the desktop and mobile clocks pulse these rings, so the keyframes ship
// with whichever view is mounted rather than living inside one of them.
function ClockRingStyles() {
  return (
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
  );
}

// ─── Mobile Clock In / Out ────────────────────────────────────────────────────
/*
  Native controls rather than the Modus web components: inside a 390 px frame
  these keep a 44 px touch target and let the OS raise its own picker, which is
  what the field app would actually do.
*/
const mobileInputStyle: React.CSSProperties = {
  width: "100%", height: 44, borderRadius: 8, border: "1px solid #cbced4",
  padding: "0 12px", fontSize: 14, color: "#252a2e", fontFamily: OS,
  background: "#ffffff", boxSizing: "border-box",
};

function MobileField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: "#6a6e79", fontFamily: OS, ...OS_FVS, marginBottom: 5 }}>
        {label}{required && <span style={{ color: "#ab1f26" }}> *</span>}
      </p>
      {children}
    </div>
  );
}

function MobileSelect({ value, onChange, options, placeholder, invalid }: {
  value: string; onChange: (v: string) => void; options: string[];
  placeholder: string; invalid?: boolean;
}) {
  return (
    <div style={{ position: "relative" }}>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{
          ...mobileInputStyle,
          appearance: "none", paddingRight: 34, cursor: "pointer",
          color: value ? "#252a2e" : "#8b8f96",
          borderColor: invalid ? "#ab1f26" : "#cbced4",
        }}>
        <option value="" disabled>{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={16} style={{ position: "absolute", right: 12, top: 14, color: "#6a6e79", pointerEvents: "none" }} />
    </div>
  );
}

/*
  The desktop attestation dialog is position:fixed and would escape the phone
  frame, so the same questions are asked here in a bottom sheet.
*/
function MobileAttestationSheet({ day, onClose, onSubmit }: {
  day: { label: string; date: number };
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { questions } = useAttestationConfig();
  const [answers, setAnswers] = useState<AttestationAnswerState>(() =>
    Object.fromEntries(questions.map((q) => [q.id, { answer: null, comment: "" }]))
  );
  const canSubmit = attestationCanSubmit(questions, answers);

  const YesNo = ({ value, onSelect }: { value: "yes" | "no" | null; onSelect: (v: "yes" | "no") => void }) => (
    <div className="flex gap-[8px]">
      {(["yes", "no"] as const).map(opt => (
        <button key={opt} type="button" onClick={() => onSelect(opt)} className="flex-1"
          style={{
            background: value === opt ? "#e8f2fa" : "#ffffff",
            border: `1px solid ${value === opt ? "#0063a3" : "#cbced4"}`,
            color: value === opt ? "#0063a3" : "#464b52",
            borderRadius: 8, padding: "11px 0", fontSize: 14,
            fontWeight: value === opt ? 700 : 400, fontFamily: OS, cursor: "pointer",
          }}>
          {opt === "yes" ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );

  const setAnswer = (id: string, answer: AttestationAnswer) => {
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], answer } }));
  };

  const setComment = (id: string, comment: string) => {
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], comment } }));
  };

  return (
    <>
      <p style={{ fontSize: 17, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>Hello Adam!</p>
      <p style={{ fontSize: 13, color: "#464b52", fontFamily: OS, ...OS_FVS, marginBottom: 14 }}>
        Attesting for {day.label} 2026/07/{day.date}
      </p>

      <div className="rounded-[8px] px-[12px] py-[10px] mb-[16px]" style={{ background: "#dcedf9" }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS, marginBottom: 8 }}>TOTAL</p>
        <div className="flex items-center">
          {[["REG", "0.04"], ["OT", "0.00"], ["DT", "0.00"], ["TVL", "11.00"], ["QUA", "2.00"], ["PD", "0.00"]].map(([k, v], i) => (
            <div key={k} className="flex-1 flex flex-col items-center" style={{ borderLeft: i > 0 ? "1px solid #a8c8e8" : undefined }}>
              <p style={{ fontSize: 9, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>{k}</p>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>{v}</p>
            </div>
          ))}
        </div>
      </div>

      {questions.map((q) => {
        const entry = answers[q.id] ?? { answer: null, comment: "" };
        const commentNeeded = attestationCommentRequired(q, entry.answer);
        return (
          <div key={q.id} style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS, marginBottom: 8 }}>
              {q.question} <span style={{ color: "#ab1f26" }}>*</span>
            </p>
            <YesNo value={entry.answer} onSelect={(v) => setAnswer(q.id, v)} />
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#6a6e79", fontFamily: OS, ...OS_FVS, marginBottom: 5 }}>
                Additional comments {commentNeeded && <span style={{ color: "#ab1f26" }}>*</span>}
              </p>
              <input
                type="text"
                value={entry.comment}
                placeholder={commentNeeded ? "Required" : "Optional note…"}
                onChange={(e) => setComment(q.id, e.target.value)}
                style={{
                  ...mobileInputStyle,
                  borderColor: commentNeeded && !entry.comment.trim() ? "#ab1f26" : "#cbced4",
                }}
              />
            </div>
          </div>
        );
      })}

      <button type="button" disabled={!canSubmit} onClick={onSubmit} className="w-full"
        style={{
          background: canSubmit ? "#0063a3" : "#d4d6dd", color: "#ffffff", border: "none", borderRadius: 8,
          padding: "13px 0", marginBottom: 10, fontSize: 14, fontWeight: 700, fontFamily: OS,
          cursor: canSubmit ? "pointer" : "not-allowed",
        }}>
        Submit
      </button>
      <button type="button" onClick={onClose} className="w-full"
        style={{ background: "#ffffff", color: "#0063a3", border: "1px solid #0063a3", borderRadius: 8, padding: "13px 0", fontSize: 14, fontWeight: 700, fontFamily: OS, cursor: "pointer" }}>
        Cancel
      </button>
    </>
  );
}

function MobileSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 20 }} />
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 21,
        background: "#ffffff", borderRadius: "20px 20px 0 0",
        padding: "12px 20px 28px", maxHeight: "82%", overflowY: "auto",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "#d4d6dd", margin: "0 auto 16px" }} />
        {children}
      </div>
    </>
  );
}

function MobileClockView({ session }: { session: ClockSession }) {
  const {
    clocked, elapsed, breakElapsed, mealElapsed,
    timeline, job, setJob, phase, setPhase, crew, setCrew, dept, setDept,
    travel, setTravel, qty, setQty, perDiem, setPerDiem, comment, setComment,
    showMealModal, setShowMealModal, mealAck, setMealAck,
    showEarlyBreakModal, setShowEarlyBreakModal, showBreakAlert,
    showOffSiteModal, setShowOffSiteModal,
    showSiteMap, setShowSiteMap,
    punchMapPin, setPunchMapPin,
    locating, offSiteSim, setOffSiteSim, clockedInOffSite,
    site, fix, siteDistance, onSite,
    missingDetails, detailsComplete, detailsPrompt,
    attested, attestDay,
    breakRows, mealRows,
    fmt, stateColor, stateColorLight, stateColorMid, stateColorStrong, btnLabel,
    breakRemainingFmt,
    handleMainBtn, doClockIn, confirmEndBreak, handleBreak, startOnDutyMeal,
  } = session;

  const [showDetailsSheet, setShowDetailsSheet] = useState(false);
  const [attestDayOpen, setAttestDayOpen] = useState<{ label: string; date: number } | null>(null);
  // A rejected punch should land the employee straight on the fields to fill.
  const onMainPress = () => {
    if (clocked === "out" && !detailsComplete) setShowDetailsSheet(true);
    handleMainBtn();
  };
  const now = new Date();
  const statusLabel = clocked === "out" ? "Not Clocked In" : clocked === "break" ? "On Break" : clocked === "meal" ? "On-Duty Meal" : "On the Clock";
  const activeTimer = clocked === "break" ? breakElapsed : clocked === "meal" ? mealElapsed : elapsed;

  const card: React.CSSProperties = MOBILE_CARD;
  // Filled in before the punch, mirroring the desktop Job Details form.
  const jobDetailsCard = (
          <div className="mt-[12px]" style={{ ...card, overflow: "hidden" }}>
            <div className="flex items-center justify-between" style={{ padding: "12px 14px", borderBottom: "1px solid #eef0f3" }}>
              <div className="flex items-center gap-[10px]">
                <div className="flex items-center justify-center shrink-0" style={{ width: 30, height: 30, borderRadius: 8, background: "#e8f2fa" }}>
                  <Briefcase size={16} style={{ color: "#0063a3" }} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>Job Details</p>
                {clocked === "out" && !detailsComplete && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#ab1f26", background: "#fdeaea", borderRadius: 999, padding: "2px 7px", fontFamily: OS }}>
                    {missingDetails.length} missing
                  </span>
                )}
              </div>
              <button type="button" onClick={() => setShowDetailsSheet(true)}
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, fontSize: 12, fontWeight: 700, color: "#0063a3", fontFamily: OS }}>
                {clocked === "out" ? (detailsComplete ? "Edit" : "Add") : "Switch"}
              </button>
            </div>
            <button type="button" onClick={() => setShowDetailsSheet(true)}
              className="w-full text-left" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "10px 14px 12px" }}>
              {([
                ["Job", job],
                ["Phase", phase],
                ["Crew", crew],
                ["Department", dept],
              ] as const).map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-[12px]" style={{ marginBottom: 4 }}>
                  <p style={{ fontSize: 11, color: "#6a6e79", fontFamily: OS, ...OS_FVS, flexShrink: 0 }}>{label}</p>
                  <p style={{ fontSize: 12, fontWeight: value ? 600 : 400, color: value ? "#252a2e" : detailsPrompt ? "#ab1f26" : "#a3a3a3", fontFamily: OS, ...OS_FVS, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {value || "Required"}
                  </p>
                </div>
              ))}
              {(travel || qty || perDiem || comment) && (
                <div className="flex items-center gap-[6px] mt-[8px] pt-[8px]" style={{ borderTop: "1px dashed #e0e1e9", flexWrap: "wrap" }}>
                  {[
                    travel ? `Travel ${travel}` : null,
                    qty ? `Qty ${qty}` : null,
                    perDiem ? "Per Diem" : null,
                    comment ? "Comment added" : null,
                  ].filter(Boolean).map(chip => (
                    <span key={chip as string} style={{ fontSize: 10, color: "#464b52", background: "#f1f1f6", borderRadius: 999, padding: "3px 8px", fontFamily: OS }}>
                      {chip}
                    </span>
                  ))}
                </div>
              )}
            </button>

            {/* Site — the geofence belongs to the selected job, so it lives here */}
            {clocked === "out" && (
              <div style={{
                padding: "10px 14px 12px",
                borderTop: "1px solid #eef0f3",
                background: !site || locating ? "#f7f7f8" : onSite ? "#e8f7ed" : "#fffbeb",
              }}>
                <div className="flex items-center gap-[10px]">
                  {locating && site
                    ? <LoaderCircle size={17} className="shrink-0 animate-spin" style={{ color: "#6a6e79" }} />
                    : site && fix ? (
                      <button type="button" onClick={() => setShowSiteMap(true)}
                        title="View on map" aria-label={`View ${site.name} on a map`}
                        className="shrink-0 flex items-center justify-center"
                        style={{
                          width: 32, height: 32, padding: 0, borderRadius: 999, cursor: "pointer",
                          background: "#ffffff", border: `1px solid ${onSite ? "#b7e0c4" : "#f4d6a4"}`,
                        }}>
                        <MapPin size={17} style={{ color: onSite ? "#15803d" : "#d97706" }} />
                      </button>
                    ) : <MapPin size={17} className="shrink-0" style={{ color: !site ? "#a3a3a3" : onSite ? "#15803d" : "#d97706" }} />}
                  <div style={{ minWidth: 0 }}>
                    {!site ? (
                      <p style={{ fontSize: 12, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>Select a job to check its site.</p>
                    ) : locating ? (
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#464b52", fontFamily: OS, ...OS_FVS }}>Getting your location…</p>
                    ) : (
                      <>
                        <p style={{ fontSize: 12, fontWeight: 700, color: onSite ? "#15803d" : "#92400e", fontFamily: OS, ...OS_FVS }}>
                          {onSite ? "On site" : `${formatDistance(siteDistance)} away`}
                        </p>
                        <p style={{ fontSize: 11, color: onSite ? "#3f7d55" : "#b45309", fontFamily: OS, ...OS_FVS, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {onSite
                            ? `${site.name} · ±${fix?.accuracyMeters} m`
                            : `${site.name} · outside the ${site.radiusMeters} m radius`}
                        </p>
                      </>
                    )}
                  </div>
                </div>
                {site && (
                  <div className="mt-[10px] pt-[10px] flex items-center gap-[8px]" style={{ borderTop: "1px dashed #d4d6dd" }}>
                    <p style={{ fontSize: 11, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>Simulate:</p>
                    {([{ label: "On site", value: false }, { label: "Off site", value: true }] as const).map(opt => (
                      <button key={opt.label} type="button" onClick={() => setOffSiteSim(opt.value)}
                        aria-pressed={offSiteSim === opt.value}
                        style={{
                          fontSize: 11, fontFamily: OS, borderRadius: 999, padding: "3px 10px", cursor: "pointer",
                          background: offSiteSim === opt.value ? "#0063a3" : "#ffffff",
                          color: offSiteSim === opt.value ? "#ffffff" : "#464b52",
                          border: `1px solid ${offSiteSim === opt.value ? "#0063a3" : "#cbced4"}`,
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
  );
  const sheetTitle: React.CSSProperties = { fontSize: 17, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS };
  const sheetBody: React.CSSProperties = { fontSize: 13, color: "#464b52", fontFamily: OS, ...OS_FVS, lineHeight: 1.6 };

  return (
    <div className="flex justify-center py-[32px]" style={{ background: "#f1f1f6" }}>
      <ClockRingStyles />
      {/* Device frame */}
      <div style={{ background: "#1b1d21", borderRadius: 48, padding: 10, boxShadow: "0 24px 60px rgba(0,0,0,0.28)" }}>
        <div style={{
          position: "relative", width: 390, height: 844, borderRadius: 38,
          overflow: "hidden", background: "#f1f1f6", display: "flex", flexDirection: "column",
        }}>
          {/* Status bar */}
          <div className="flex items-center justify-between shrink-0 px-[28px]" style={{ height: 44, background: "#ffffff" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>
              {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </p>
            <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: 8, width: 112, height: 28, borderRadius: 14, background: "#1b1d21" }} />
            <div className="flex items-center gap-[5px]">
              {[4, 7, 10, 13].map(h => (
                <div key={h} style={{ width: 3, height: h, borderRadius: 1, background: "#252a2e" }} />
              ))}
              <div style={{ width: 22, height: 11, borderRadius: 3, border: "1px solid #252a2e", padding: 1, marginLeft: 3 }}>
                <div style={{ width: "72%", height: "100%", borderRadius: 1, background: "#252a2e" }} />
              </div>
            </div>
          </div>

          {/* App bar */}
          <div className="flex items-center justify-between shrink-0 px-[16px]"
            style={{ height: 56, background: "#ffffff", borderBottom: "1px solid #e0e1e9" }}>
            <AlignJustify size={20} style={{ color: "#464b52" }} />
            <div className="flex items-center gap-[8px]">
              <div className="flex items-center justify-center" style={{ width: 22, height: 22, borderRadius: 4, background: "#0e416c" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#ffffff", fontFamily: OS }}>T</p>
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>Clock In &amp; Out</p>
            </div>
            <div className="flex items-center justify-center" style={{ width: 28, height: 28, borderRadius: 999, background: "#0e416c" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#ffffff", fontFamily: OS }}>JD</p>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 px-[16px] pt-[16px]" style={{ overflowY: "auto" }}>
            {/* Timer */}
            <div className="px-[16px] py-[18px] text-center" style={{ ...card }}>
              <p style={{ fontSize: 12, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>
                {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <p style={{ fontSize: 40, fontWeight: 800, color: "#252a2e", fontFamily: OS, ...OS_FVS, letterSpacing: "-1px", lineHeight: 1.2 }}>
                {fmt(activeTimer)}
              </p>
              <div className="flex items-center justify-center gap-[6px]">
                <div style={{ width: 8, height: 8, borderRadius: 999, background: stateColor }} />
                <p style={{ fontSize: 12, fontWeight: 700, color: stateColor, fontFamily: OS, ...OS_FVS }}>{statusLabel}</p>
              </div>
            </div>

            {/* Off-site flag */}
            {clocked !== "out" && clockedInOffSite && (
              <div className="mt-[12px] flex items-center gap-[10px] px-[14px] py-[12px]"
                style={{ ...card, background: "#fffbeb", border: "1px solid #fbbf24" }}>
                <MapPin size={17} style={{ color: "#d97706", flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#92400e", fontFamily: OS, ...OS_FVS }}>Clocked in off site</p>
                  <p style={{ fontSize: 11, color: "#b45309", fontFamily: OS, ...OS_FVS }}>Flagged for supervisor review.</p>
                </div>
              </div>
            )}

            {/* Break reminder */}
            {showBreakAlert && (
              <div className="mt-[12px] px-[14px] py-[12px]" style={{ ...card, background: "#fffbeb", border: "1px solid #fbbf24" }}>
                <div className="flex items-center gap-[10px]">
                  <AlertTriangle size={17} style={{ color: "#d97706", flexShrink: 0 }} />
                  <div className="flex-1">
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#92400e", fontFamily: OS, ...OS_FVS }}>Break Reminder</p>
                    <p style={{ fontSize: 11, color: "#b45309", fontFamily: OS, ...OS_FVS }}>
                      Clocked in {Math.floor(elapsed / 60)} min. Time for a break.
                    </p>
                  </div>
                </div>
                <button type="button" onClick={handleBreak} className="w-full"
                  style={{ background: "#d97706", color: "#ffffff", border: "none", borderRadius: 8, padding: "9px 0", marginTop: 10, fontSize: 13, fontWeight: 700, fontFamily: OS, cursor: "pointer" }}>
                  Take Break
                </button>
              </div>
            )}

            {/* Meal banner */}
            {clocked === "meal" && (
              <div className="mt-[12px] flex items-center gap-[10px] px-[14px] py-[12px]"
                style={{ ...card, background: "#e8f7ed", border: "1px solid #bbe6ca" }}>
                <Utensils size={17} style={{ color: "#15803d", flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#15803d", fontFamily: OS, ...OS_FVS }}>On-Duty Meal · {fmt(mealElapsed)}</p>
                  <p style={{ fontSize: 11, color: "#3f7d55", fontFamily: OS, ...OS_FVS }}>Still on the clock and paid.</p>
                </div>
              </div>
            )}

            {/* Primary action */}
            <div className="relative flex items-center justify-center mx-auto my-[20px]" style={{ width: 216, height: 216 }}>
              <div className="ring-outer absolute rounded-full" style={{ width: 216, height: 216, background: stateColorLight }} />
              <div className="ring-mid absolute rounded-full" style={{ width: 168, height: 168, background: stateColorMid }} />
              <div className="ring-inner absolute rounded-full" style={{ width: 126, height: 126, background: stateColorStrong }} />
              <button type="button" onClick={onMainPress}
                className="relative flex items-center justify-center rounded-full transition-transform active:scale-95"
                style={{
                  width: 92, height: 92, background: stateColor, border: "none", cursor: "pointer",
                  color: "#ffffff", fontSize: 12, letterSpacing: "0.08em", fontFamily: OS, fontWeight: 900,
                  boxShadow: `0 4px 24px ${stateColorStrong}`, textAlign: "center", lineHeight: 1.2,
                }}>
                {btnLabel}
              </button>
            </div>

            {/* Sub actions */}
            {clocked === "in" && (
              <div className="grid grid-cols-3 gap-[10px]">
                {([
                  { label: "Switch Job", icon: <Briefcase size={19} style={{ color: "#464b52" }} />, onPress: () => setShowDetailsSheet(true) },
                  { label: "Take Break", icon: <Clock size={19} style={{ color: "#464b52" }} />, onPress: handleBreak },
                  { label: "On-Duty Meal", icon: <Utensils size={19} style={{ color: "#464b52" }} />, onPress: () => { setMealAck(false); setShowMealModal(true); } },
                ]).map(a => (
                  <button key={a.label} type="button" onClick={a.onPress}
                    className="flex flex-col items-center gap-[6px]"
                    style={{ ...card, cursor: "pointer", padding: "12px 4px" }}>
                    {a.icon}
                    <p style={{ fontSize: 11, color: "#464b52", fontFamily: OS, ...OS_FVS, textAlign: "center" }}>{a.label}</p>
                  </button>
                ))}
              </div>
            )}

            {jobDetailsCard}

            {/* Daily attestation */}
            <div className="mt-[12px]" style={{ ...card, overflow: "hidden", borderColor: "#fbad26", background: "#fffbf0" }}>
              <div className="flex items-center gap-[10px]" style={{ padding: "12px 14px" }}>
                <div className="flex items-center justify-center shrink-0" style={{ width: 22, height: 22, borderRadius: 999, background: "#fbad26" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#ffffff", fontFamily: OS }}>i</span>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS, flex: 1 }}>Daily Attestation</p>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>
                  {attested.size}/{ATTESTATION_DAYS.length}
                </span>
              </div>
              <div style={{ padding: "0 14px 14px" }}>
                <p style={{ fontSize: 11, color: "#6a6e79", fontFamily: OS, ...OS_FVS, marginBottom: 10 }}>
                  Tap a date to complete or view.
                </p>
                <div className="flex gap-[8px]">
                  {ATTESTATION_DAYS.map(({ label, date }) => {
                    const done = attested.has(date);
                    return (
                      <button key={date} type="button" onClick={() => setAttestDayOpen({ label, date })}
                        className="flex flex-col items-center justify-center flex-1"
                        style={{
                          height: 66, cursor: "pointer", borderRadius: 8,
                          background: done ? "#e8f5e9" : "#ffffff",
                          border: `1px solid ${done ? "#2e7d32" : "#fbad26"}`,
                        }}>
                        <div className="flex items-center justify-center" style={{ width: 18, height: 18, borderRadius: 999, marginBottom: 4, background: done ? "#2e7d32" : "#fbad26" }}>
                          {done
                            ? <Check size={10} style={{ color: "#ffffff" }} strokeWidth={3} />
                            : <X size={10} style={{ color: "#ffffff" }} strokeWidth={3} />}
                        </div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: done ? "#2e7d32" : "#c47f00", fontFamily: OS, ...OS_FVS, lineHeight: 1.2 }}>{label}</p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: done ? "#2e7d32" : "#c47f00", fontFamily: OS, ...OS_FVS, lineHeight: 1.2 }}>{date}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <MobileTimesheetSection
              breakRows={breakRows}
              mealRows={mealRows}
              todayLabel={now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              onOpenMap={setPunchMapPin}
            />

            {/* Activity */}
            {timeline.length > 0 && (
              <div className="mt-[16px] mb-[16px]">
                <p className="mb-[10px]" style={{ fontSize: 13, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>Today's Activity</p>
                <div style={{ ...card, padding: "14px" }}>
                  {timeline.map((e, i) => (
                    <div key={i} className="flex gap-[10px]">
                      <div className="flex flex-col items-center">
                        <div style={{ width: 9, height: 9, borderRadius: 999, background: e.color, marginTop: 4, flexShrink: 0 }} />
                        {i < timeline.length - 1 && <div style={{ width: 1, flex: 1, background: "#e0e1e9", marginTop: 2, minHeight: 22 }} />}
                      </div>
                      <div style={{ paddingBottom: i < timeline.length - 1 ? 14 : 0, minWidth: 0 }}>
                        <div className="flex items-center gap-[6px]">
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>{e.label}</p>
                          {e.flagged && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: "#92400e", background: "#fde68a", borderRadius: 4, padding: "1px 5px", fontFamily: OS }}>Flagged</span>
                          )}
                        </div>
                        <p style={{ fontSize: 11, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>{e.time} · {e.sub}</p>
                        {e.location && (
                          <div className="flex items-center gap-[4px] mt-[2px]">
                            <MapPin size={10} style={{ color: e.flagged ? "#b45309" : "#6a6e79", flexShrink: 0 }} />
                            <p style={{ fontSize: 10, color: e.flagged ? "#b45309" : "#6a6e79", fontFamily: OS, ...OS_FVS }}>{e.location}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom tab bar */}
          <div className="shrink-0" style={{ background: "#ffffff", borderTop: "1px solid #e0e1e9" }}>
            <div className="flex items-start justify-around pt-[8px]">
              {([
                { label: "Time",      icon: Clock,    active: true },
                { label: "Timesheet", icon: FileText, active: false },
                { label: "Jobs",      icon: Briefcase, active: false },
                { label: "More",      icon: AlignJustify, active: false },
              ]).map(t => (
                <div key={t.label} className="flex flex-col items-center gap-[3px]" style={{ width: 72 }}>
                  <t.icon size={19} style={{ color: t.active ? "#0063a3" : "#8a8e97" }} />
                  <p style={{ fontSize: 10, fontWeight: t.active ? 700 : 400, color: t.active ? "#0063a3" : "#8a8e97", fontFamily: OS, ...OS_FVS }}>{t.label}</p>
                </div>
              ))}
            </div>
            <div style={{ width: 134, height: 5, borderRadius: 3, background: "#1b1d21", margin: "8px auto 8px" }} />
          </div>

          {/* Daily attestation sheet */}
          {attestDayOpen && (
            <MobileSheet open onClose={() => setAttestDayOpen(null)}>
              <MobileAttestationSheet
                day={attestDayOpen}
                onClose={() => setAttestDayOpen(null)}
                onSubmit={() => { attestDay(attestDayOpen.date); setAttestDayOpen(null); }}
              />
            </MobileSheet>
          )}

          {/* Punch location map */}
          {punchMapPin && (
            <MobileSheet open onClose={() => setPunchMapPin(null)}>
              <PunchLocationModalContent
                pin={punchMapPin}
                mapWidth={350}
                mapHeight={220}
                onClose={() => setPunchMapPin(null)}
                layout="mobile"
              />
            </MobileSheet>
          )}

          {/* Site map sheet */}
          {site && fix && (
            <MobileSheet open={showSiteMap} onClose={() => setShowSiteMap(false)}>
              <div className="flex items-center gap-[10px] mb-[12px]">
                <div className="flex items-center justify-center shrink-0" style={{ width: 36, height: 36, borderRadius: 999, background: onSite ? "#e8f7ed" : "#fef3e2" }}>
                  <MapPin size={18} style={{ color: onSite ? "#15803d" : "#d97706" }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={sheetTitle}>{onSite ? "On site" : `${formatDistance(siteDistance)} away`}</p>
                  <p style={{ fontSize: 12, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>{site.name}</p>
                </div>
              </div>
              <SiteMap site={site} fix={fix} width={350} height={220} />
              <p className="mt-[12px] mb-[16px]" style={{ fontSize: 12, color: "#464b52", fontFamily: OS, ...OS_FVS, lineHeight: 1.5 }}>
                {formatCoords(fix)} · {site.address}
              </p>
              <button type="button" onClick={() => setShowSiteMap(false)} className="w-full"
                style={{ background: "#0063a3", color: "#ffffff", border: "none", borderRadius: 8, padding: "13px 0", fontSize: 14, fontWeight: 700, fontFamily: OS, cursor: "pointer" }}>
                Close
              </button>
            </MobileSheet>
          )}

          {/* Off-site sheet */}
          {site && fix && (
            <MobileSheet open={showOffSiteModal} onClose={() => setShowOffSiteModal(false)}>
              <div className="flex items-center gap-[10px] mb-[12px]">
                <div className="flex items-center justify-center shrink-0" style={{ width: 36, height: 36, borderRadius: 999, background: "#fef3e2" }}>
                  <MapPin size={18} style={{ color: "#d97706" }} />
                </div>
                <p style={sheetTitle}>You're Away From the Job Site</p>
              </div>
              <p style={{ ...sheetBody, marginBottom: 14 }}>
                You're {formatDistance(siteDistance)} from {site.name}, outside its {site.radiusMeters} m radius.
                You can still clock in, but this entry will be flagged for review.
              </p>
              <div className="px-[12px] py-[10px] mb-[18px]" style={{ background: "#f7f7fb", borderRadius: 8, border: "1px solid #e0e1e9" }}>
                <p style={{ fontSize: 11, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>Your location</p>
                <p style={{ fontSize: 12, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>{formatCoords(fix)} · ±{fix.accuracyMeters} m</p>
              </div>
              <button type="button" onClick={doClockIn} className="w-full"
                style={{ background: "#d97706", color: "#ffffff", border: "none", borderRadius: 8, padding: "13px 0", marginBottom: 10, fontSize: 14, fontWeight: 700, fontFamily: OS, cursor: "pointer" }}>
                Clock In Anyway
              </button>
              <button type="button" onClick={() => setShowOffSiteModal(false)} className="w-full"
                style={{ background: "#ffffff", color: "#0063a3", border: "1px solid #0063a3", borderRadius: 8, padding: "13px 0", fontSize: 14, fontWeight: 700, fontFamily: OS, cursor: "pointer" }}>
                Cancel
              </button>
            </MobileSheet>
          )}

          {/* On-duty meal sheet */}
          <MobileSheet open={showMealModal} onClose={() => setShowMealModal(false)}>
            <div className="flex items-center gap-[10px] mb-[12px]">
              <div className="flex items-center justify-center shrink-0" style={{ width: 36, height: 36, borderRadius: 999, background: "#e8f7ed" }}>
                <Utensils size={18} style={{ color: "#15803d" }} />
              </div>
              <p style={sheetTitle}>Start On-Duty Meal</p>
            </div>
            <p style={{ ...sheetBody, marginBottom: 14 }}>
              You stay clocked in and paid for this meal. Take it at your post when the job
              can't be left unattended.
            </p>
            <div className="flex items-center gap-[8px] px-[12px] py-[10px] mb-[16px]"
              style={{ background: "#e8f7ed", border: "1px solid #bbe6ca", borderRadius: 8 }}>
              <Check size={15} strokeWidth={3} style={{ color: "#15803d", flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: "#15803d", fontFamily: OS, ...OS_FVS }}>
                On-duty meal waiver assigned to you
              </p>
            </div>
            <label className="flex items-center gap-[10px] mb-[18px]" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={mealAck} onChange={() => setMealAck(v => !v)} style={{ width: 18, height: 18, accentColor: "#0063a3" }} />
              <span style={{ fontSize: 13, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>I agree to take my meal on duty today.</span>
            </label>
            <button type="button" onClick={startOnDutyMeal} disabled={!mealAck} className="w-full"
              style={{
                background: mealAck ? "#1e8a44" : "#d4d6dd", color: "#ffffff", border: "none", borderRadius: 8,
                padding: "13px 0", marginBottom: 10, fontSize: 14, fontWeight: 700, fontFamily: OS, cursor: mealAck ? "pointer" : "not-allowed",
              }}>
              Start On-Duty Meal
            </button>
            <button type="button" onClick={() => setShowMealModal(false)} className="w-full"
              style={{ background: "#ffffff", color: "#0063a3", border: "1px solid #0063a3", borderRadius: 8, padding: "13px 0", fontSize: 14, fontWeight: 700, fontFamily: OS, cursor: "pointer" }}>
              Cancel
            </button>
          </MobileSheet>

          {/* Early break sheet */}
          <MobileSheet open={showEarlyBreakModal} onClose={() => setShowEarlyBreakModal(false)}>
            <div className="flex items-center gap-[10px] mb-[12px]">
              <div className="flex items-center justify-center shrink-0" style={{ width: 36, height: 36, borderRadius: 999, background: "#fef3e2" }}>
                <AlertTriangle size={18} style={{ color: "#d97706" }} />
              </div>
              <p style={sheetTitle}>Clocking Back In Early</p>
            </div>
            <p style={{ ...sheetBody, marginBottom: 8 }}>
              You're clocking back in early. Confirm this is intentional, or wait until your break is finished.
            </p>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#d97706", fontFamily: OS, ...OS_FVS, marginBottom: 18 }}>
              Time remaining on break: {breakRemainingFmt}
            </p>
            <button type="button" onClick={confirmEndBreak} className="w-full"
              style={{ background: "#0063a3", color: "#ffffff", border: "none", borderRadius: 8, padding: "13px 0", marginBottom: 10, fontSize: 14, fontWeight: 700, fontFamily: OS, cursor: "pointer" }}>
              Confirm Early Clock In
            </button>
            <button type="button" onClick={() => setShowEarlyBreakModal(false)} className="w-full"
              style={{ background: "#ffffff", color: "#0063a3", border: "1px solid #0063a3", borderRadius: 8, padding: "13px 0", fontSize: 14, fontWeight: 700, fontFamily: OS, cursor: "pointer" }}>
              Wait — Stay on Break
            </button>
          </MobileSheet>

          {/* Job details sheet */}
          <MobileSheet open={showDetailsSheet} onClose={() => setShowDetailsSheet(false)}>
            <p style={{ ...sheetTitle, marginBottom: 4 }}>Job Details</p>
            <p style={{ ...sheetBody, marginBottom: 14 }}>
              Tell us where this time is charged before you clock in.
            </p>

            {detailsPrompt && (
              <div className="flex items-start gap-[8px] mb-[14px]" style={{ background: "#fdeaea", border: "1px solid #f3b8b8", borderRadius: 8, padding: "10px 12px" }}>
                <AlertTriangle size={15} style={{ color: "#ab1f26", flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: "#8b1a1f", fontFamily: OS, ...OS_FVS }}>
                  Add {missingDetails.join(", ")} to clock in.
                </p>
              </div>
            )}

            <MobileField label="Job" required>
              <MobileSelect value={job} onChange={setJob} options={CLOCK_JOB_OPTIONS}
                placeholder="Select job" invalid={detailsPrompt && !job} />
              {site && (
                <p style={{ fontSize: 11, color: "#6a6e79", fontFamily: OS, ...OS_FVS, marginTop: 5 }}>
                  {site.name} · {site.radiusMeters} m geofence
                </p>
              )}
            </MobileField>

            <MobileField label="Phase" required>
              <MobileSelect value={phase} onChange={setPhase} options={CLOCK_PHASE_OPTIONS}
                placeholder="Select phase" invalid={detailsPrompt && !phase} />
            </MobileField>

            <MobileField label="Crew" required>
              <MobileSelect value={crew} onChange={setCrew} options={CLOCK_CREW_OPTIONS}
                placeholder="Select crew" invalid={detailsPrompt && !crew} />
            </MobileField>

            <MobileField label="Department" required>
              <MobileSelect value={dept} onChange={setDept} options={CLOCK_DEPT_OPTIONS}
                placeholder="Select department" invalid={detailsPrompt && !dept} />
            </MobileField>

            <div className="grid grid-cols-2 gap-[12px]">
              <MobileField label="Travel">
                <input type="number" min={0} step={0.25} value={travel}
                  onChange={(e) => setTravel(e.target.value)} style={mobileInputStyle} />
              </MobileField>
              <MobileField label="Quantity">
                <input type="number" min={0} value={qty}
                  onChange={(e) => setQty(e.target.value)} style={mobileInputStyle} />
              </MobileField>
            </div>

            <label className="flex items-center gap-[10px] mb-[14px]" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={perDiem} onChange={() => setPerDiem(v => !v)}
                style={{ width: 18, height: 18, accentColor: "#0063a3" }} />
              <span style={{ fontSize: 13, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>Per Diem</span>
            </label>

            <MobileField label="Comment">
              <input type="text" value={comment} placeholder="Optional note…"
                onChange={(e) => setComment(e.target.value)} style={mobileInputStyle} />
            </MobileField>

            <button type="button" onClick={() => setShowDetailsSheet(false)} className="w-full"
              style={{ background: "#0063a3", color: "#ffffff", border: "none", borderRadius: 8, padding: "13px 0", marginTop: 4, fontSize: 14, fontWeight: 700, fontFamily: OS, cursor: "pointer" }}>
              Done
            </button>
          </MobileSheet>
        </div>
      </div>
    </div>
  );
}

function ClockInOutPage() {
  const session = useClockSession();
  const {
    clocked, setClocked, elapsed, setElapsed, breakElapsed, setBreakElapsed, mealElapsed,
    setStartTime, setBreakStart,
    mealRows, breakRows, timeline,
    showMealModal, setShowMealModal, mealAck, setMealAck,
    showEarlyBreakModal, setShowEarlyBreakModal, showBreakAlert,
    showOffSiteModal, setShowOffSiteModal,
    showSiteMap, setShowSiteMap,
    punchMapPin, setPunchMapPin,
    crew, setCrew, dept, setDept, job, setJob, phase, setPhase,
    travel, setTravel, qty, setQty, perDiem, setPerDiem, comment, setComment,
    showForm, setShowForm,
    locating, offSiteSim, setOffSiteSim, clockedInOffSite,
    site, fix, siteDistance, onSite,
    missingDetails, detailsPrompt,
    attested, attestDay,
    fmt, stateColor, stateColorLight, stateColorMid, stateColorStrong, btnLabel,
    breakRemainingFmt,
    handleMainBtn, doClockIn, confirmEndBreak, handleBreak, startOnDutyMeal,
  } = session;

  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");

  // The form sits below the punch button, so pull it into view when we reject.
  const formRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (detailsPrompt && viewMode === "desktop") {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [detailsPrompt, viewMode]);

  const now = new Date();
  const mockTimesheetEntries = getMockTimesheetEntries();
  const totalReg = mockTimesheetEntries.reduce((s, e) => s + e.reg, 0);
  const totalOT  = mockTimesheetEntries.reduce((s, e) => s + e.ot, 0);
  const totalTravel = mockTimesheetEntries.reduce((s, e) => s + e.travel, 0);

  const SelectField = ({ label, value, onChange, options, required, invalid }: {
    label: string; value: string; onChange: (v: string) => void; options: string[];
    required?: boolean; invalid?: boolean;
  }) => (
    <ModusWcSelect
      label={label}
      size="sm"
      required={required}
      value={value}
      feedback={invalid ? { level: "error", message: "Required" } : undefined}
      options={[
        { label: `Select ${label.toLowerCase()}`, value: "", disabled: true },
        ...options.map(o => ({ label: o, value: o })),
      ]}
      onInputChange={(e) => onChange(e.target.value)}
    />
  );

  const fmtHMS = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${h}h ${m}m ${sec}s`;
  };

  return (
    <div style={{ background: "#f1f1f6", fontFamily: OS }}>
      {/* Early break modal */}
      {viewMode === "desktop" && showEarlyBreakModal && (
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

      {/* Punch location map — timesheet entry clock in/out */}
      {viewMode === "desktop" && punchMapPin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setPunchMapPin(null)}>
          <div className="bg-white rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.18)] p-[32px]"
            style={{ width: 560, maxWidth: "90vw" }} onClick={e => e.stopPropagation()}>
            <PunchLocationModalContent
              pin={punchMapPin}
              mapWidth={496}
              mapHeight={320}
              onClose={() => setPunchMapPin(null)}
              layout="desktop"
            />
          </div>
        </div>
      )}

      {/* Site location map */}
      {viewMode === "desktop" && showSiteMap && site && fix && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setShowSiteMap(false)}>
          <div className="bg-white rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.18)] p-[32px]"
            style={{ width: 560, maxWidth: "90vw" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-[12px] mb-[16px]">
              <div className="flex h-[40px] w-[40px] items-center justify-center rounded-full shrink-0" style={{ background: onSite ? "#e8f7ed" : "#fef3e2" }}>
                <MapPin size={20} style={{ color: onSite ? "#15803d" : "#d97706" }} />
              </div>
              <div>
                <p style={{ fontSize: 17, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>
                  {onSite ? `On site · ${site.name}` : `${formatDistance(siteDistance)} from ${site.name}`}
                </p>
                <p style={{ fontSize: 12, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>
                  {formatCoords(fix)} · {site.address}
                </p>
              </div>
            </div>

            <SiteMap site={site} fix={fix} width={496} height={320} />

            <div className="flex justify-end mt-[24px]">
              <ModusWcButton color="primary" variant="filled" size="md"
                onButtonClick={() => setShowSiteMap(false)}>
                Close
              </ModusWcButton>
            </div>
          </div>
        </div>
      )}

      {/* Off-site clock-in confirmation */}
      {viewMode === "desktop" && showOffSiteModal && site && fix && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setShowOffSiteModal(false)}>
          <div className="bg-white rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.18)] p-[32px]"
            style={{ width: 480, maxWidth: "90vw" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-[12px] mb-[16px]">
              <div className="flex h-[40px] w-[40px] items-center justify-center rounded-full shrink-0" style={{ background: "#fef3e2" }}>
                <MapPin size={20} style={{ color: "#d97706" }} />
              </div>
              <p style={{ fontSize: 17, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>You're Away From the Job Site</p>
            </div>

            <p style={{ fontSize: 13, color: "#464b52", fontFamily: OS, ...OS_FVS, lineHeight: 1.6, marginBottom: 16 }}>
              You're {formatDistance(siteDistance)} from {site.name}, outside its {site.radiusMeters} m radius.
              You can still clock in, but your supervisor will see this entry flagged for review.
            </p>

            <div className="rounded-[8px] px-[12px] py-[10px] mb-[24px]" style={{ background: "#f7f7fb", border: "1px solid #e0e1e9" }}>
              <div className="flex justify-between gap-[12px] mb-[6px]">
                <p style={{ fontSize: 12, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>Job site</p>
                <p style={{ fontSize: 12, color: "#252a2e", fontFamily: OS, ...OS_FVS, textAlign: "right" }}>{site.address}</p>
              </div>
              <div className="flex justify-between gap-[12px]">
                <p style={{ fontSize: 12, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>Your location</p>
                <p style={{ fontSize: 12, color: "#252a2e", fontFamily: OS, ...OS_FVS, textAlign: "right" }}>
                  {formatCoords(fix)} · ±{fix.accuracyMeters} m
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-[12px]">
              <ModusWcButton color="primary" variant="outlined" size="md"
                onButtonClick={() => setShowOffSiteModal(false)}>
                Cancel
              </ModusWcButton>
              <ModusWcButton color="warning" variant="filled" size="md" onButtonClick={doClockIn}>
                Clock In Anyway
              </ModusWcButton>
            </div>
          </div>
        </div>
      )}

      {/* On-duty meal confirmation */}
      {viewMode === "desktop" && showMealModal && (
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
      <div className="flex items-center justify-between gap-[16px] px-[32px] pt-[24px] pb-[20px]"
        style={{ borderBottom: "1px solid #e0e1e9", background: "#ffffff" }}>
        <div>
          <p style={{ fontSize: 22, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>Clock In &amp; Out</p>
          <p style={{ fontSize: 13, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>
            {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        {/* One shift, two renderings — the switcher keeps the running clock. */}
        <div className="flex shrink-0 items-center gap-[2px] rounded-[6px] p-[3px]" style={{ background: "#f1f1f6", border: "1px solid #e0e1e9" }}>
          {([
            { value: "desktop", label: "Desktop" },
            { value: "mobile",  label: "Mobile" },
          ] as const).map(opt => (
            <button key={opt.value} type="button" onClick={() => setViewMode(opt.value)}
              aria-pressed={viewMode === opt.value}
              style={{
                fontSize: 12, fontFamily: OS, fontWeight: viewMode === opt.value ? 700 : 400,
                padding: "5px 14px", borderRadius: 4, cursor: "pointer", border: "none",
                background: viewMode === opt.value ? "#ffffff" : "transparent",
                color: viewMode === opt.value ? "#0e416c" : "#6a6e79",
                boxShadow: viewMode === opt.value ? "0 1px 2px rgba(0,0,0,0.12)" : "none",
              }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {viewMode === "mobile" && <MobileClockView session={session} />}

      {viewMode === "desktop" && (
      <div className="flex" style={{ minHeight: 520, overflow: "hidden" }}>
        {/* ── Left panel: concentric circle clock ── */}
        <div className="flex flex-col items-center justify-start flex-1 pt-[56px] pb-[48px] px-[32px]" style={{ minWidth: 0, overflow: "hidden" }}>
          {/* Clock display */}
          <div className="w-full mb-[24px]" style={{ maxWidth: 420 }}>
            <ClockDisplay elapsed={elapsed} clocked={clocked} />
          </div>

          {/* Off-site clock-in flag */}
          {clocked !== "out" && clockedInOffSite && (
            <div className="w-full flex items-center gap-[12px] mb-[24px] px-[16px] py-[12px] rounded-[8px]"
              style={{ background: "#fffbeb", border: "1px solid #fbbf24", maxWidth: 420 }}>
              <MapPin size={18} style={{ color: "#d97706", flexShrink: 0 }} />
              <div className="flex-1">
                <p style={{ fontSize: 13, fontWeight: 700, color: "#92400e", fontFamily: OS, ...OS_FVS }}>Clocked in off site</p>
                <p style={{ fontSize: 12, color: "#b45309", fontFamily: OS, ...OS_FVS }}>
                  This entry is flagged for supervisor review.
                </p>
              </div>
            </div>
          )}

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
          <ClockRingStyles />
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
                <p style={{ fontSize: 11, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>Switch Job</p>
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
            <div ref={formRef} className="mt-[28px] w-full bg-white rounded-[10px] shadow-[0_2px_12px_rgba(0,0,0,0.08)] overflow-hidden" style={{ maxWidth: 420 }}>
              <div className="p-[20px]">
              <p style={{ fontSize: 13, fontWeight: 700, color: "#0e416c", fontFamily: OS, ...OS_FVS, marginBottom: 14 }}>Job Details</p>
              {detailsPrompt && (
                <div className="mb-[14px]">
                  <ModusWcAlert
                    variant="error"
                    alertTitle="Add job details before clocking in"
                    alertDescription={`Still needed: ${missingDetails.join(", ")}.`}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-[12px]">
                <SelectField label="Crew" value={crew} onChange={setCrew} options={CLOCK_CREW_OPTIONS}
                  required invalid={detailsPrompt && !crew} />
                <SelectField label="Department" value={dept} onChange={setDept} options={CLOCK_DEPT_OPTIONS}
                  required invalid={detailsPrompt && !dept} />
                <div className="col-span-2">
                  <SelectField label="Job" value={job} onChange={setJob} options={CLOCK_JOB_OPTIONS}
                    required invalid={detailsPrompt && !job} />
                </div>
                <SelectField label="Phase" value={phase} onChange={setPhase} options={CLOCK_PHASE_OPTIONS}
                  required invalid={detailsPrompt && !phase} />
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

              {/* Site — the geofence belongs to the selected job, so it lives here */}
              {clocked === "out" && (
                <div className="px-[20px] py-[14px]" style={{
                  borderTop: "1px solid #eef0f3",
                  background: !site || locating ? "#f7f7f8" : onSite ? "#e8f7ed" : "#fffbeb",
                }}>
                  <div className="flex items-center gap-[12px]">
                    {locating && site
                      ? <LoaderCircle size={18} className="shrink-0 animate-spin" style={{ color: "#6a6e79" }} />
                      : site && fix ? (
                        <button type="button" onClick={() => setShowSiteMap(true)}
                          title="View on map" aria-label={`View ${site.name} on a map`}
                          className="shrink-0 flex items-center justify-center"
                          style={{
                            width: 34, height: 34, padding: 0, borderRadius: 999, cursor: "pointer",
                            background: "#ffffff", border: `1px solid ${onSite ? "#b7e0c4" : "#f4d6a4"}`,
                          }}>
                          <MapPin size={18} style={{ color: onSite ? "#15803d" : "#d97706" }} />
                        </button>
                      ) : <MapPin size={18} className="shrink-0" style={{ color: !site ? "#a3a3a3" : onSite ? "#15803d" : "#d97706" }} />}
                    <div className="flex-1" style={{ minWidth: 0 }}>
                      {!site ? (
                        <p style={{ fontSize: 13, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>
                          Select a job to check its site.
                        </p>
                      ) : locating ? (
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#464b52", fontFamily: OS, ...OS_FVS }}>
                          Getting your location…
                        </p>
                      ) : (
                        <>
                          <p style={{ fontSize: 13, fontWeight: 700, color: onSite ? "#15803d" : "#92400e", fontFamily: OS, ...OS_FVS }}>
                            {onSite ? `On site · ${site.name}` : `${formatDistance(siteDistance)} from ${site.name}`}
                          </p>
                          <p style={{ fontSize: 12, color: onSite ? "#3f7d55" : "#b45309", fontFamily: OS, ...OS_FVS }}>
                            {onSite
                              ? `${formatDistance(siteDistance)} from site center · accurate to ${fix?.accuracyMeters} m`
                              : `Outside the ${site.radiusMeters} m job site radius`}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  {site && fix && !locating && (
                    <p className="mt-[8px]" style={{ fontSize: 11, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>
                      {formatCoords(fix)} · {site.address}
                    </p>
                  )}
                  {/* Prototype control: real device coordinates never land on a mock site. */}
                  {site && (
                    <div className="mt-[10px] pt-[10px] flex items-center gap-[8px]" style={{ borderTop: "1px dashed #d4d6dd" }}>
                      <p style={{ fontSize: 11, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>Simulate:</p>
                      {([{ label: "On site", value: false }, { label: "Off site", value: true }] as const).map(opt => (
                        <button key={opt.label} type="button" onClick={() => setOffSiteSim(opt.value)}
                          aria-pressed={offSiteSim === opt.value}
                          style={{
                            fontSize: 11, fontFamily: OS, borderRadius: 4, padding: "2px 8px", cursor: "pointer",
                            background: offSiteSim === opt.value ? "#0063a3" : "#ffffff",
                            color: offSiteSim === opt.value ? "#ffffff" : "#464b52",
                            border: `1px solid ${offSiteSim === opt.value ? "#0063a3" : "#cbced4"}`,
                          }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Timesheet table — inside left panel, below circle/form */}
          <div className="w-full mt-[32px] rounded-[8px] overflow-hidden" style={{ border: "1px solid #e0e1e9" }}>
            <div className="px-[16px] py-[12px]" style={{ background: "#0e416c" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#ffffff", fontFamily: OS, ...OS_FVS }}>
                Timesheet for Pay Period August 1 – August 7, 2026
              </p>
            </div>
            <AttestationPanel days={ATTESTATION_DAYS} attested={attested} onAttest={attestDay} />
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
                  {mockTimesheetEntries.map((e, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "#ffffff" : "#fafafa", borderBottom: "1px solid #e0e1e9" }}>
                      <td className="px-[6px] py-[6px]"><p style={{ fontSize: 11, color: "#252a2e", fontFamily: OS, ...OS_FVS, whiteSpace: "nowrap" }}>{e.date}</p></td>
                      <td className="px-[6px] py-[6px]"><p style={{ fontSize: 11, color: "#252a2e", fontFamily: OS, ...OS_FVS, whiteSpace: "nowrap" }}>{e.jobNum}</p></td>
                      <td className="px-[6px] py-[6px]">
                        <p style={{ fontSize: 11, color: "#252a2e", fontFamily: OS, ...OS_FVS, whiteSpace: "nowrap" }}>{e.start}</p>
                        <TimesheetMapButton pin={e.clockInLoc} onOpen={setPunchMapPin} />
                      </td>
                      <td className="px-[6px] py-[6px]">
                        <p style={{ fontSize: 11, color: "#252a2e", fontFamily: OS, ...OS_FVS, whiteSpace: "nowrap" }}>{e.end}</p>
                        <TimesheetMapButton pin={e.clockOutLoc} onOpen={setPunchMapPin} />
                      </td>
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
                      <td className="px-[10px] py-[8px]">
                        <p style={{ fontSize: 12, color: "#92400e", fontFamily: OS, ...OS_FVS, whiteSpace: "nowrap" }}>{br.start}</p>
                        <TimesheetMapButton pin={br.startLoc} onOpen={setPunchMapPin} />
                      </td>
                      <td className="px-[10px] py-[8px]">
                        <p style={{ fontSize: 12, color: "#92400e", fontFamily: OS, ...OS_FVS, whiteSpace: "nowrap" }}>
                          {br.end ?? "—"}
                        </p>
                        {br.end && <TimesheetMapButton pin={br.endLoc} onOpen={setPunchMapPin} />}
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
                      <td className="px-[10px] py-[8px]">
                        <p style={{ fontSize: 12, color: "#15803d", fontFamily: OS, ...OS_FVS, whiteSpace: "nowrap" }}>{mr.start}</p>
                        <TimesheetMapButton pin={mr.startLoc} onOpen={setPunchMapPin} />
                      </td>
                      <td className="px-[10px] py-[8px]">
                        <p style={{ fontSize: 12, color: "#15803d", fontFamily: OS, ...OS_FVS, whiteSpace: "nowrap" }}>{mr.end ?? "—"}</p>
                        {mr.end && <TimesheetMapButton pin={mr.endLoc} onOpen={setPunchMapPin} />}
                      </td>
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
                      <div className="flex items-center gap-[8px]">
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#252a2e", fontFamily: OS, ...OS_FVS }}>{e.label}</p>
                        {e.flagged && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#92400e", background: "#fde68a", borderRadius: 4, padding: "1px 6px", fontFamily: OS, whiteSpace: "nowrap" }}>
                            Flagged
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 12, color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>{e.sub}</p>
                      {e.location && (
                        <div className="flex items-center gap-[4px] mt-[2px]">
                          <MapPin size={11} style={{ color: e.flagged ? "#b45309" : "#6a6e79", flexShrink: 0 }} />
                          <p style={{ fontSize: 11, color: e.flagged ? "#b45309" : "#6a6e79", fontFamily: OS, ...OS_FVS }}>{e.location}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

function ComplianceDashboard() {
  const [activeSection, setActiveSection] = useState<ExceptionView>("all");
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
  const matchesFilters = (e: BreakEmployee) => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.role.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterEmployee   && e.name       !== filterEmployee)   return false;
    if (filterCrew       && e.crew       !== filterCrew)       return false;
    if (filterSupervisor && e.supervisor !== filterSupervisor) return false;
    if (filterPm         && e.pm         !== filterPm)         return false;
    if (filterJob        && e.job        !== filterJob)        return false;
    if (filterCostCenter && e.costCenter !== filterCostCenter) return false;
    return true;
  };

  const inScope = MOCK_EMPLOYEES.filter(e => matchesFilters(e));

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

  const totalPenalty = premium.reduce((s, e) => s + e.penaltyAmount, 0);
  const totalViolations = premium.reduce((s, e) => s + e.penaltyCount, 0);

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
        <SummaryCard label="Missed Rest Break" count={missed.length} sub="Past the window, no break taken"
          tone={{ color: STATE_STYLE.missed.color, bg: STATE_STYLE.missed.bg }} section="missed" />
        <SummaryCard label="Late Break" count={lateTake.length} sub="Break taken outside the window"
          tone={{ color: STATE_STYLE.late.color, bg: STATE_STYLE.late.bg }} section="late" />
        <SummaryCard label="Meal Premiums Incurred" count={totalViolations} sub={`$${totalPenalty.toFixed(2)} across ${premium.length} employees`}
          tone={{ color: "#a35b06", bg: "#fef3e2" }} section="premium" />
      </div>
      <p className="text-[12px]" style={{ color: "#6a6e79", fontFamily: OS, marginBottom: 24 }}>
        A missed or late break earns a premium, so an employee can appear in more than one category.
      </p>

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
                activeSection === "missed"   ? "Missed Rest Break" :
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

// ─── Timesheet Summary ────────────────────────────────────────────────────────

type ViolationRowStatus = "pending" | "approved" | "deleted";

type SummaryAttestationDay = { label: string; date: number };

type SummaryViolation = {
  id: string;
  parentEntryId: string;
  violationTypeId: string;
  label: string;
  date: string;
  start: string;
  end: string;
  dept: string;
  job: string;
  phase: string;
  state: string;
  wo: string;
  payRate: string;
  reg: number;
  ot: number;
  dt: number;
  travel: number;
  qty: number;
  perDiem: number;
  perDiemRate: number;
  unionCode: string;
  wageCode: string;
  rateLevel: string;
  comment: string;
  approvedBy?: string;
  secondApprovedBy?: string;
  complete: boolean;
  exported: boolean;
  status: ViolationRowStatus;
  deletionComment?: string;
  deletedBy?: string;
};

type SummaryTimesheetEntry = {
  id: string;
  date: string;
  start: string;
  end: string;
  dept: string;
  job: string;
  phase: string;
  state: string;
  wo: string;
  payRate: string;
  reg: number;
  ot: number;
  dt: number;
  travel: number;
  qty: number;
  perDiem: number;
  perDiemRate: number;
  unionCode: string;
  wageCode: string;
  rateLevel: string;
  comment: string;
  approvedBy?: string;
  secondApprovedBy?: string;
  complete: boolean;
  exported: boolean;
  hourAlert?: boolean;
  jobHighlight?: boolean;
  phaseHighlight?: boolean;
};

type SummaryBreakRow = {
  id: string;
  parentEntryId: string;
  date: string;
  start: string;
  end: string;
  duration: number;
  dept: string;
  job: string;
  state: string;
  wo: string;
  payRate: string;
  unionCode: string;
  wageCode: string;
  rateLevel: string;
  comment: string;
  approvedBy?: string;
  secondApprovedBy?: string;
  complete: boolean;
  exported: boolean;
};

type SummaryExpense = {
  id: string;
  date: string;
  dept: string;
  job: string;
  phase: string;
  name: string;
  category: string;
  vendor: string;
  total: number;
  addedBy: string;
  attachments: number;
  comment: string;
  approvedBy?: string;
  secondApprovedBy?: string;
  exported: boolean;
};

type SummaryEmployee = {
  id: string;
  name: string;
  employeeNum: string;
  initials: string;
  attestationDays: SummaryAttestationDay[];
  entries: SummaryTimesheetEntry[];
  breaks: SummaryBreakRow[];
  expenses: SummaryExpense[];
  violations: SummaryViolation[];
};

const violationFromEntry = (
  id: string,
  parentEntryId: string,
  violationTypeId: string,
  label: string,
  entry: SummaryTimesheetEntry,
  hours = 1.0,
): SummaryViolation => ({
  id,
  parentEntryId,
  violationTypeId,
  label,
  date: entry.date,
  start: "—",
  end: "—",
  dept: entry.dept,
  job: entry.job,
  phase: entry.phase,
  state: entry.state,
  wo: entry.wo,
  payRate: entry.payRate,
  reg: hours,
  ot: 0,
  dt: 0,
  travel: 0,
  qty: 0,
  perDiem: 0,
  perDiemRate: 0,
  unionCode: entry.unionCode,
  wageCode: entry.wageCode,
  rateLevel: entry.rateLevel,
  comment: "",
  complete: false,
  exported: false,
  status: "pending",
});

const SUMMARY_MOCK_EMPLOYEES: SummaryEmployee[] = [
  {
    id: "emp-adam",
    name: "Adam Hazey",
    employeeNum: "740",
    initials: "AH",
    attestationDays: [{ label: "Sat", date: 15 }],
    entries: [
      {
        id: "adam-1",
        date: "Sat, Aug 15",
        start: "7:00 AM", end: "10:00 AM",
        dept: "Main Orders", job: "003699 - AEP Carrollton Sub", phase: "5554 - Renewal - Asphalt",
        state: "TX", wo: "WO-8841", payRate: "$42.50",
        reg: 3, ot: 0, dt: 0, travel: 0, qty: 0, perDiem: 0, perDiemRate: 0,
        unionCode: "UA-12", wageCode: "E1", rateLevel: "5b", comment: "",
        approvedBy: "Luc Peron", secondApprovedBy: "Luc Peron", complete: true, exported: false,
      },
    ],
    breaks: [
      {
        id: "adam-break-1",
        parentEntryId: "adam-1",
        date: "Sat, Aug 15",
        start: "8:30 AM", end: "9:00 AM",
        duration: 0.5,
        dept: "Main Orders", job: "003699 - AEP Carrollton Sub",
        state: "TX", wo: "WO-8841", payRate: "$42.50",
        unionCode: "UA-12", wageCode: "E1", rateLevel: "5b", comment: "",
        approvedBy: "Luc Peron", secondApprovedBy: "Luc Peron", complete: true, exported: false,
      },
    ],
    expenses: [],
    violations: [],
  },
  {
    id: "emp-connor",
    name: "Connor McDavid",
    employeeNum: "053",
    initials: "CM",
    attestationDays: [
      { label: "Sat", date: 15 },
      { label: "Mon", date: 17 },
      { label: "Tue", date: 18 },
    ],
    entries: [
      {
        id: "connor-1",
        date: "Sat, Aug 15",
        start: "6:00 AM", end: "6:00 PM",
        dept: "Main Orders", job: "003699 - AEP Carrollton Sub", phase: "5554 - Renewal - Asphalt",
        state: "TX", wo: "WO-8841", payRate: "$48.00",
        reg: 12, ot: 2, dt: 0, travel: 0, qty: 0, perDiem: 0, perDiemRate: 0,
        unionCode: "UA-12", wageCode: "E1", rateLevel: "5b", comment: "",
        complete: false, exported: false, hourAlert: true,
      },
      {
        id: "connor-2",
        date: "Mon, Aug 17",
        start: "6:30 AM", end: "3:30 PM",
        dept: "Main Orders", job: "003700 - Job B", phase: "5555 - Phase B",
        state: "TX", wo: "WO-9012", payRate: "$48.00",
        reg: 8, ot: 0, dt: 0, travel: 1, qty: 0, perDiem: 0, perDiemRate: 0,
        unionCode: "UA-12", wageCode: "E1", rateLevel: "5b", comment: "",
        approvedBy: "Luc Peron", secondApprovedBy: "Luc Peron", complete: true, exported: false,
        hourAlert: true, jobHighlight: true, phaseHighlight: true,
      },
      {
        id: "connor-3",
        date: "Tue, Aug 18",
        start: "7:00 AM", end: "3:00 PM",
        dept: "Main Orders", job: "003699 - AEP Carrollton Sub", phase: "5554 - Renewal - Asphalt",
        state: "TX", wo: "WO-8841", payRate: "$48.00",
        reg: 8, ot: 0, dt: 0, travel: 0, qty: 0, perDiem: 0, perDiemRate: 0,
        unionCode: "UA-12", wageCode: "E1", rateLevel: "5b", comment: "",
        approvedBy: "Luc Peron", secondApprovedBy: "Luc Peron", complete: true, exported: false,
        hourAlert: true,
      },
      {
        id: "connor-4",
        date: "Tue, Aug 18",
        start: "3:00 PM", end: "5:00 PM",
        dept: "Main Orders", job: "003701 - Job C", phase: "5556 - Phase C",
        state: "TX", wo: "WO-9155", payRate: "$48.00",
        reg: 0, ot: 0, dt: 0, travel: 0, qty: 0, perDiem: 0, perDiemRate: 0,
        unionCode: "UA-12", wageCode: "E1", rateLevel: "5b", comment: "",
        approvedBy: "Luc Peron", secondApprovedBy: "Luc Peron", complete: true, exported: false,
        jobHighlight: true,
      },
    ],
    breaks: [
      {
        id: "connor-break-sat",
        parentEntryId: "connor-1",
        date: "Sat, Aug 15",
        start: "12:00 PM", end: "12:30 PM",
        duration: 0.5,
        dept: "Main Orders", job: "003699 - AEP Carrollton Sub",
        state: "TX", wo: "WO-8841", payRate: "$48.00",
        unionCode: "UA-12", wageCode: "E1", rateLevel: "5b", comment: "",
        complete: false, exported: false,
      },
      {
        id: "connor-break-tue",
        parentEntryId: "connor-3",
        date: "Tue, Aug 18",
        start: "12:00 PM", end: "12:30 PM",
        duration: 0.5,
        dept: "Main Orders", job: "003699 - AEP Carrollton Sub",
        state: "TX", wo: "WO-8841", payRate: "$48.00",
        unionCode: "UA-12", wageCode: "E1", rateLevel: "5b", comment: "",
        approvedBy: "Luc Peron", secondApprovedBy: "Luc Peron", complete: true, exported: false,
      },
    ],
    expenses: [
      {
        id: "connor-exp-1",
        date: "Tue, Aug 18",
        dept: "Main Orders",
        job: "003699 - AEP Carrollton Sub",
        phase: "5554 - Renewal - Asphalt",
        name: "Connor McDavid",
        category: "Airfare",
        vendor: "American Airlines",
        total: 30,
        addedBy: "Connor McDavid",
        attachments: 1,
        comment: "",
        approvedBy: "Luc Peron",
        secondApprovedBy: "Luc Peron",
        exported: false,
      },
    ],
    violations: [],
  },
];

const BREAK_VIOLATION_IDS = new Set([
  "missed_break_attestation",
  "missed_meal",
  "late_meal",
  "short_meal",
]);

const isBreakViolation = (v: SummaryViolation) => BREAK_VIOLATION_IDS.has(v.violationTypeId);

const breakViolationDisplayLabel = (v: SummaryViolation) =>
  defaultViolations().find((rule) => rule.id === v.violationTypeId)?.label ?? v.label;

const connorEmp = SUMMARY_MOCK_EMPLOYEES.find((e) => e.id === "emp-connor")!;
connorEmp.violations = [
  violationFromEntry("viol-connor-1-meal", "connor-1", "missed_meal", "Missed Meal", connorEmp.entries[0]),
  violationFromEntry("viol-connor-1-rest", "connor-1", "missed_break_attestation", "Missed Rest Break", connorEmp.entries[0]),
  violationFromEntry("viol-connor-2-meal", "connor-2", "missed_meal", "Missed Meal", connorEmp.entries[1]),
  violationFromEntry("viol-connor-3-late", "connor-3", "late_meal", "Late Meal", connorEmp.entries[2]),
  {
    ...violationFromEntry(
      "viol-connor-deleted-break",
      "connor-2",
      "missed_break_attestation",
      "Missed break",
      connorEmp.entries[1],
    ),
    status: "deleted",
    approvedBy: undefined,
    secondApprovedBy: undefined,
    complete: false,
  },
];

function ViolationRemoveModal({
  premiumLabel,
  isBreakViolation: breakViolation,
  onConfirm,
  onClose,
}: {
  premiumLabel: string;
  isBreakViolation?: boolean;
  onConfirm: (comment: string) => void;
  onClose: () => void;
}) {
  const [comment, setComment] = useState("");
  const valid = comment.trim().length >= 8;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
      <div className="relative w-[480px] rounded-[8px] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#e0e1e9] px-[20px] py-[14px]">
          <span className="text-[14px] font-bold text-[#252a2e]" style={{ fontFamily: OS }}>
            {breakViolation ? "Delete Break Violation" : "Remove Violation"}
          </span>
          <button type="button" onClick={onClose} className="text-[#6a6e79] hover:text-[#252a2e] transition-colors" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="px-[20px] py-[16px]">
          <div className="mb-[14px] flex gap-[10px] rounded-[4px] border border-[#fbad26] bg-[#fffbf0] p-[12px]">
            <AlertTriangle size={16} className="mt-[1px] shrink-0 text-[#856404]" />
            <p className="text-[12px] text-[#5a4a00] leading-[18px]" style={{ fontFamily: OS }}>
              Deleting <strong>{premiumLabel}</strong> removes premium pay but keeps the row on the timesheet for audit. A business reason is required.
            </p>
          </div>
          <ModusWcTextarea
            label="Deletion reason (required)"
            size="sm"
            required
            value={comment}
            placeholder="Explain why this penalty should not be paid…"
            onInputChange={(e) => setComment(e.target.value)}
          />
          {comment.trim().length > 0 && !valid && (
            <p className="mt-[6px] text-[11px] text-[#ab1f26]" style={{ fontFamily: OS }}>Enter at least 8 characters.</p>
          )}
        </div>
        <div className="flex items-center justify-end gap-[8px] border-t border-[#e0e1e9] px-[20px] py-[12px]">
          <ModusWcButton color="tertiary" variant="outlined" size="sm" onButtonClick={onClose}>Cancel</ModusWcButton>
          <ModusWcButton
            color="primary"
            variant="filled"
            size="sm"
            disabled={!valid}
            onButtonClick={() => { if (valid) onConfirm(comment.trim()); }}
          >
            <ModusWcIcon name="delete" variant="outlined" size="xs" decorative />
            Delete Violation
          </ModusWcButton>
        </div>
      </div>
    </div>
  );
}

const SUMMARY_TABLE_COLS = [
  "Approved By", "Second Approved By", "Complete", "Exported",
  "Name", "Employee #", "Date", "Start", "End", "Department", "Job", "Phase", "State", "WO#",
  "Pay Rate", "Reg", "OT", "DT", "Travel", "Quantity", "Per Diem", "Per Diem Rate", "Union Code", "Wage Code", "Rate Level", "Comment",
] as const;

const SUMMARY_TABLE_ICON_COL_WIDTH = "2%";
const SUMMARY_TABLE_COL_WIDTH_OVERRIDES: Partial<Record<(typeof SUMMARY_TABLE_COLS)[number], number>> = {
  Job: 11,
  Phase: 9.5,
  Comment: 8,
};
const SUMMARY_TABLE_RESERVED_COL_WIDTH = Object.values(SUMMARY_TABLE_COL_WIDTH_OVERRIDES).reduce((sum, width) => sum + width, 0);
const SUMMARY_TABLE_DEFAULT_COL_WIDTH =
  (98 - SUMMARY_TABLE_RESERVED_COL_WIDTH) / (SUMMARY_TABLE_COLS.length - Object.keys(SUMMARY_TABLE_COL_WIDTH_OVERRIDES).length);
const SUMMARY_TABLE_COL_WIDTHS = SUMMARY_TABLE_COLS.map((col) => {
  const override = SUMMARY_TABLE_COL_WIDTH_OVERRIDES[col];
  return `${override ?? SUMMARY_TABLE_DEFAULT_COL_WIDTH}%`;
});
const SUMMARY_TABLE_CELL = "px-[4px] py-[6px] text-[11px] min-w-0 align-top break-words";
const BREAK_ROW_CELL = "px-[4px] py-[6px] text-[11px] min-w-0 align-middle border-0";
const SUMMARY_TABLE_HEADERS: { label: string; title: string }[] = [
  { label: "Appr. By", title: "Approved By" },
  { label: "2nd Appr.", title: "Second Approved By" },
  { label: "Complete", title: "Complete" },
  { label: "Exported", title: "Exported" },
  { label: "Name", title: "Name" },
  { label: "Emp #", title: "Employee #" },
  { label: "Date", title: "Date" },
  { label: "Start", title: "Start" },
  { label: "End", title: "End" },
  { label: "Dept", title: "Department" },
  { label: "Job", title: "Job" },
  { label: "Phase", title: "Phase" },
  { label: "St", title: "State" },
  { label: "WO#", title: "WO#" },
  { label: "Pay Rt", title: "Pay Rate" },
  { label: "Reg", title: "Reg" },
  { label: "OT", title: "OT" },
  { label: "DT", title: "DT" },
  { label: "Trvl", title: "Travel" },
  { label: "Qty", title: "Quantity" },
  { label: "PD", title: "Per Diem" },
  { label: "PD Rt", title: "Per Diem Rate" },
  { label: "Union", title: "Union Code" },
  { label: "Wage", title: "Wage Code" },
  { label: "Rate", title: "Rate Level" },
  { label: "Comment", title: "Comment" },
];

const BREAK_VIOLATION_TABLE_HEADERS: { label: string; title: string }[] = [
  { label: "Appr. By", title: "Approved By" },
  { label: "2nd Appr.", title: "Second Approved By" },
  { label: "Complete", title: "Complete" },
  { label: "Exported", title: "Exported" },
  { label: "Violation Type", title: "Type of Violation" },
  { label: "Name", title: "Name" },
  { label: "Emp #", title: "Employee #" },
  { label: "Date", title: "Date" },
  { label: "Dept", title: "Department" },
  { label: "Job", title: "Job" },
  { label: "Phase", title: "Phase" },
  { label: "St", title: "State" },
  { label: "Pay Rt", title: "Pay Rate" },
  { label: "Reg", title: "Reg" },
  { label: "Union", title: "Union Code" },
  { label: "Wage", title: "Wage Code" },
  { label: "Rate", title: "Rate Level" },
  { label: "Comment", title: "Comment" },
];

const BREAK_VIOLATION_TABLE_COL_WIDTH_OVERRIDES: Record<string, number> = {
  "Type of Violation": 9,
  Job: 11,
  Phase: 9.5,
  Comment: 8,
};
const BREAK_VIOLATION_TABLE_RESERVED_COL_WIDTH = Object.values(BREAK_VIOLATION_TABLE_COL_WIDTH_OVERRIDES).reduce((sum, width) => sum + width, 0);
const BREAK_VIOLATION_TABLE_DEFAULT_COL_WIDTH =
  (98 - BREAK_VIOLATION_TABLE_RESERVED_COL_WIDTH) / (BREAK_VIOLATION_TABLE_HEADERS.length - Object.keys(BREAK_VIOLATION_TABLE_COL_WIDTH_OVERRIDES).length);
const BREAK_VIOLATION_TABLE_COL_WIDTHS = BREAK_VIOLATION_TABLE_HEADERS.map((h) => {
  const override = BREAK_VIOLATION_TABLE_COL_WIDTH_OVERRIDES[h.title];
  return `${override ?? BREAK_VIOLATION_TABLE_DEFAULT_COL_WIDTH}%`;
});
const BREAK_VIOLATION_TABLE_COL_COUNT = BREAK_VIOLATION_TABLE_HEADERS.length + 1;

type SummaryTableRow =
  | { kind: "entry"; data: SummaryTimesheetEntry }
  | { kind: "break"; data: SummaryBreakRow }
  | { kind: "violation"; data: SummaryViolation };

function buildSummaryTableRows(employee: SummaryEmployee): SummaryTableRow[] {
  const rows: SummaryTableRow[] = [];
  for (const entry of employee.entries) {
    rows.push({ kind: "entry", data: entry });
    for (const breakRow of employee.breaks.filter((b) => b.parentEntryId === entry.id)) {
      rows.push({ kind: "break", data: breakRow });
    }
  }
  return rows;
}

function buildBreakViolationRows(employee: SummaryEmployee): SummaryViolation[] {
  const rows: SummaryViolation[] = [];
  for (const entry of employee.entries) {
    for (const violation of employee.violations.filter(
      (v) => v.parentEntryId === entry.id && isBreakViolation(v),
    )) {
      rows.push(violation);
    }
  }
  return rows;
}

const SUMMARY_APPROVED_ROW_BG = "#e8f7ed";

function isSummaryRowApproved(row: SummaryTableRow): boolean {
  if (row.kind === "entry" || row.kind === "break") return !!row.data.approvedBy;
  return row.data.status !== "deleted" && (row.data.status === "approved" || !!row.data.approvedBy);
}

function summaryEntryStripeIndex(tableRows: SummaryTableRow[], idx: number): number {
  const row = tableRows[idx];
  if (row.kind === "entry") {
    return tableRows.slice(0, idx).filter((r) => r.kind === "entry").length;
  }
  if (row.kind === "break") {
    const parentIdx = tableRows.findIndex(
      (r) => r.kind === "entry" && r.data.id === row.data.parentEntryId,
    );
    if (parentIdx >= 0) {
      return tableRows.slice(0, parentIdx).filter((r) => r.kind === "entry").length;
    }
  }
  return idx;
}

function summaryRowBackground(row: SummaryTableRow, stripeIdx: number): string {
  if (row.kind === "violation" && row.data.status === "deleted") return "#f7f7f8";
  if (isSummaryRowApproved(row)) return SUMMARY_APPROVED_ROW_BG;
  if (row.kind === "violation") return "#fffbeb";
  return stripeIdx % 2 === 0 ? "#ffffff" : "#fafafa";
}

function summaryRowBorder(row: SummaryTableRow): string {
  if (row.kind === "violation" && row.data.status === "deleted") return "1px solid #e0e1e9";
  if (row.kind === "violation" && !isSummaryRowApproved(row)) return "1px solid #fde68a";
  if (isSummaryRowApproved(row)) return "1px solid #bbe6ca";
  return "1px solid #e0e1e9";
}

function readSummaryInputString(e: CustomEvent | { target?: { value?: string } }): string {
  return String(
    (e as CustomEvent<{ target?: { value?: string } }>).detail?.target?.value
    ?? (e as { target?: { value?: string } }).target?.value
    ?? "",
  );
}

function summaryCellId(rowKind: SummaryTableRow["kind"], rowId: string, field: string) {
  return `${rowKind}:${rowId}:${field}`;
}

type SummaryRowPatch = Partial<{
  approvedBy: string | undefined;
  secondApprovedBy: string | undefined;
  complete: boolean;
  exported: boolean;
  date: string;
  start: string;
  end: string;
  dept: string;
  job: string;
  phase: string;
  state: string;
  wo: string;
  payRate: string;
  reg: number;
  ot: number;
  dt: number;
  travel: number;
  qty: number;
  perDiem: number;
  perDiemRate: number;
  unionCode: string;
  wageCode: string;
  rateLevel: string;
  comment: string;
  deletedBy: string | undefined;
  deletionComment: string | undefined;
}>;

function SummaryClickEditTextCell({
  cellId,
  activeCellId,
  setActiveCellId,
  value,
  onSave,
  ariaLabel,
  display,
  editable = true,
  className = "",
  cellClassName = SUMMARY_TABLE_CELL,
}: {
  cellId: string;
  activeCellId: string | null;
  setActiveCellId: (id: string | null) => void;
  value: string;
  onSave: (v: string) => void;
  ariaLabel: string;
  display?: ReactNode;
  editable?: boolean;
  className?: string;
  cellClassName?: string;
}) {
  const editing = activeCellId === cellId;
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (editing) setDraft(value);
  }, [editing, value]);

  const commit = () => {
    if (draft !== value) onSave(draft);
    setActiveCellId(null);
  };

  const cancel = () => {
    setDraft(value);
    setActiveCellId(null);
  };

  if (!editable) {
    return (
      <td className={`${cellClassName} ${className}`} style={{ fontFamily: OS, border: cellClassName === BREAK_ROW_CELL ? "none" : undefined }}>
        {display ?? value}
      </td>
    );
  }

  return (
    <td
      className={`${cellClassName} ${!editing ? "cursor-text" : ""} ${className}`}
      style={{ fontFamily: OS, border: cellClassName === BREAK_ROW_CELL ? "none" : undefined }}
      onClick={!editing ? () => setActiveCellId(cellId) : undefined}
    >
      {editing ? (
        <div
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") cancel();
          }}
        >
          <ModusWcTextInput
            aria-label={ariaLabel}
            size="sm"
            customClass="w-full min-w-0"
            value={draft}
            onInputChange={(e) => setDraft(readSummaryInputString(e))}
            onBlur={commit}
          />
        </div>
      ) : (
        display ?? value
      )}
    </td>
  );
}

function SummaryClickEditNumberCell({
  cellId,
  activeCellId,
  setActiveCellId,
  value,
  onSave,
  ariaLabel,
  display,
  editable = true,
  className = "",
}: {
  cellId: string;
  activeCellId: string | null;
  setActiveCellId: (id: string | null) => void;
  value: number;
  onSave: (v: number) => void;
  ariaLabel: string;
  display?: ReactNode;
  editable?: boolean;
  className?: string;
}) {
  const editing = activeCellId === cellId;
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    if (editing) setDraft(String(value));
  }, [editing, value]);

  const commit = () => {
    const parsed = parseFloat(draft);
    const next = Number.isFinite(parsed) ? parsed : 0;
    if (next !== value) onSave(next);
    setActiveCellId(null);
  };

  const cancel = () => {
    setDraft(String(value));
    setActiveCellId(null);
  };

  if (!editable) {
    return (
      <td className={`${SUMMARY_TABLE_CELL} ${className}`} style={{ fontFamily: OS }}>
        {display ?? (value > 0 ? value : "—")}
      </td>
    );
  }

  return (
    <td
      className={`${SUMMARY_TABLE_CELL} ${!editing ? "cursor-text" : ""} ${className}`}
      style={{ fontFamily: OS }}
      onClick={!editing ? () => setActiveCellId(cellId) : undefined}
    >
      {editing ? (
        <div
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") cancel();
          }}
        >
          <ModusWcNumberInput
            aria-label={ariaLabel}
            size="sm"
            customClass="w-full min-w-0"
            value={draft}
            onInputChange={(e) => setDraft(readSummaryInputString(e))}
            onBlur={commit}
          />
        </div>
      ) : (
        display ?? (value > 0 ? value : "—")
      )}
    </td>
  );
}

function SummaryEditableDataCells({
  rowKind,
  rowId,
  employee,
  data,
  activeCellId,
  setActiveCellId,
  onPatch,
  onEmployeePatch,
  editable = true,
  hourAlert,
  jobHighlight,
  phaseHighlight,
  deleted,
  hoursMode = "full",
  phaseExtra,
  approvedByCell,
  secondApprovedByCell,
  completeCell,
  exportedCell,
  afterExportedCell,
  columnsMode = "full",
}: {
  rowKind: SummaryTableRow["kind"];
  rowId: string;
  employee: SummaryEmployee;
  data: SummaryRowPatch & { complete: boolean; exported: boolean; date: string; start: string; end: string; dept: string; job: string; state: string; wo: string; payRate: string; unionCode: string; wageCode: string; rateLevel: string; comment: string; reg?: number; ot?: number; dt?: number; travel?: number; qty?: number; perDiem?: number; perDiemRate?: number; phase?: string; approvedBy?: string; secondApprovedBy?: string };
  activeCellId: string | null;
  setActiveCellId: (id: string | null) => void;
  onPatch: (patch: SummaryRowPatch) => void;
  onEmployeePatch: (patch: Partial<Pick<SummaryEmployee, "name" | "employeeNum">>) => void;
  editable?: boolean;
  hourAlert?: boolean;
  jobHighlight?: boolean;
  phaseHighlight?: boolean;
  deleted?: boolean;
  hoursMode?: "full" | "dash";
  phaseExtra?: ReactNode;
  approvedByCell?: ReactNode;
  secondApprovedByCell?: ReactNode;
  completeCell?: ReactNode;
  exportedCell?: ReactNode;
  afterExportedCell?: ReactNode;
  columnsMode?: "full" | "breakViolation";
}) {
  const cell = (field: string) => summaryCellId(rowKind, rowId, field);
  const hourCell = (val: number, alert?: boolean, strike?: boolean) => (
    <span style={{
      color: strike ? "#6a6e79" : alert && val > 0 ? "#ab1f26" : "#252a2e",
      fontWeight: alert && val > 0 && !strike ? 700 : 400,
      textDecoration: strike ? "line-through" : "none",
    }}>
      {val > 0 ? val.toFixed(2) : "—"}
    </span>
  );
  const highlightCell = (val: string, on?: boolean, strike?: boolean) => (
    <span style={{
      display: "inline-block",
      padding: "2px 6px",
      borderRadius: 4,
      background: on && !strike ? "#dcedf9" : "transparent",
      color: strike ? "#6a6e79" : "#252a2e",
      textDecoration: strike ? "line-through" : "none",
    }}>
      {val}
    </span>
  );
  const statusMark = (done: boolean) =>
    done ? <Check size={12} color="#15803d" /> : <span style={{ color: "#a3a3a3" }}>—</span>;
  const dash = <span style={{ color: "#a3a3a3" }}>—</span>;
  const hoursEditable = editable && hoursMode === "full";
  const breakViolationColumns = columnsMode === "breakViolation";

  return (
    <>
      <td className={SUMMARY_TABLE_CELL} style={{ fontFamily: OS }} onClick={(e) => e.stopPropagation()}>
        {approvedByCell ?? (
          data.approvedBy ? (
            <span
              className={editable ? "inline-flex cursor-text items-center gap-[4px] min-w-0" : "inline-flex items-center gap-[4px] min-w-0"}
              onClick={editable ? () => setActiveCellId(cell("approvedBy")) : undefined}
            >
              <Check size={12} color="#15803d" />
              {activeCellId === cell("approvedBy") ? (
                <ModusWcTextInput
                  aria-label="Approved by"
                  size="sm"
                  customClass="w-full min-w-0"
                  value={data.approvedBy}
                  onInputChange={(e) => onPatch({ approvedBy: readSummaryInputString(e) || undefined })}
                  onBlur={() => setActiveCellId(null)}
                />
              ) : (
                <span className="text-[10px] break-words">{data.approvedBy}</span>
              )}
            </span>
          ) : (
            <StyledCheckbox checked={false} onChange={() => {}} />
          )
        )}
      </td>
      <td className={SUMMARY_TABLE_CELL} style={{ fontFamily: OS }} onClick={(e) => e.stopPropagation()}>
        {secondApprovedByCell ?? (
          data.secondApprovedBy ? (
            <span
              className={editable ? "inline-flex cursor-text items-center gap-[4px] min-w-0" : "inline-flex items-center gap-[4px] min-w-0"}
              onClick={editable ? () => setActiveCellId(cell("secondApprovedBy")) : undefined}
            >
              <Check size={12} color="#15803d" />
              {activeCellId === cell("secondApprovedBy") ? (
                <ModusWcTextInput
                  aria-label="Second approved by"
                  size="sm"
                  customClass="w-full min-w-0"
                  value={data.secondApprovedBy}
                  onInputChange={(e) => onPatch({ secondApprovedBy: readSummaryInputString(e) || undefined })}
                  onBlur={() => setActiveCellId(null)}
                />
              ) : (
                <span className="text-[10px] break-words">{data.secondApprovedBy}</span>
              )}
            </span>
          ) : (
            <StyledCheckbox checked={false} onChange={() => {}} />
          )
        )}
      </td>
      <td
        className={`${SUMMARY_TABLE_CELL} ${editable ? "cursor-pointer" : ""}`}
        style={{ fontFamily: OS }}
        onClick={editable && !completeCell ? () => onPatch({ complete: !data.complete }) : undefined}
      >
        {completeCell ?? statusMark(data.complete)}
      </td>
      <td
        className={`${SUMMARY_TABLE_CELL} ${editable ? "cursor-pointer" : ""}`}
        style={{ fontFamily: OS }}
        onClick={editable && !exportedCell ? () => onPatch({ exported: !data.exported }) : undefined}
      >
        {exportedCell ?? statusMark(data.exported)}
      </td>
      {afterExportedCell ? (
        <td className={SUMMARY_TABLE_CELL} style={{ fontFamily: OS }} onClick={(e) => e.stopPropagation()}>
          {afterExportedCell}
        </td>
      ) : null}
      <SummaryClickEditTextCell
        cellId={cell("name")}
        activeCellId={activeCellId}
        setActiveCellId={setActiveCellId}
        value={employee.name}
        ariaLabel="Employee name"
        editable={editable}
        onSave={(v) => onEmployeePatch({ name: v })}
      />
      <SummaryClickEditTextCell
        cellId={cell("employeeNum")}
        activeCellId={activeCellId}
        setActiveCellId={setActiveCellId}
        value={employee.employeeNum}
        ariaLabel="Employee number"
        editable={editable}
        onSave={(v) => onEmployeePatch({ employeeNum: v })}
      />
      <SummaryClickEditTextCell
        cellId={cell("date")}
        activeCellId={activeCellId}
        setActiveCellId={setActiveCellId}
        value={data.date}
        ariaLabel="Date"
        editable={editable}
        onSave={(v) => onPatch({ date: v })}
      />
      {!breakViolationColumns && (
        <>
          <SummaryClickEditTextCell
            cellId={cell("start")}
            activeCellId={activeCellId}
            setActiveCellId={setActiveCellId}
            value={data.start}
            ariaLabel="Start time"
            editable={editable}
            onSave={(v) => onPatch({ start: v })}
          />
          <SummaryClickEditTextCell
            cellId={cell("end")}
            activeCellId={activeCellId}
            setActiveCellId={setActiveCellId}
            value={data.end}
            ariaLabel="End time"
            editable={editable}
            onSave={(v) => onPatch({ end: v })}
          />
        </>
      )}
      <SummaryClickEditTextCell
        cellId={cell("dept")}
        activeCellId={activeCellId}
        setActiveCellId={setActiveCellId}
        value={data.dept}
        ariaLabel="Department"
        editable={editable}
        onSave={(v) => onPatch({ dept: v })}
      />
      <SummaryClickEditTextCell
        cellId={cell("job")}
        activeCellId={activeCellId}
        setActiveCellId={setActiveCellId}
        value={data.job}
        ariaLabel="Job"
        editable={editable}
        display={highlightCell(data.job, jobHighlight, deleted)}
        onSave={(v) => onPatch({ job: v })}
      />
      {phaseExtra ? (
        <td className={SUMMARY_TABLE_CELL} style={{ fontFamily: OS }}>
          <div className="flex flex-col items-start gap-[6px] min-w-0">
            {data.phase !== undefined ? (
              <span
                className={`min-w-0 break-words ${editable ? "cursor-text" : ""}`}
                onClick={editable ? () => setActiveCellId(cell("phase")) : undefined}
              >
                {activeCellId === cell("phase") ? (
                  <div
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setActiveCellId(null);
                    }}
                  >
                    <ModusWcTextInput
                      aria-label="Phase"
                      size="sm"
                      customClass="w-full min-w-0"
                      value={data.phase}
                      onInputChange={(e) => onPatch({ phase: readSummaryInputString(e) })}
                      onBlur={() => setActiveCellId(null)}
                    />
                  </div>
                ) : (
                  highlightCell(data.phase, phaseHighlight, deleted)
                )}
              </span>
            ) : null}
            {phaseExtra}
          </div>
        </td>
      ) : (
        <SummaryClickEditTextCell
          cellId={cell("phase")}
          activeCellId={activeCellId}
          setActiveCellId={setActiveCellId}
          value={data.phase ?? ""}
          ariaLabel="Phase"
          editable={editable && data.phase !== undefined}
          display={data.phase !== undefined ? highlightCell(data.phase, phaseHighlight, deleted) : dash}
          onSave={(v) => onPatch({ phase: v })}
        />
      )}
      <SummaryClickEditTextCell
        cellId={cell("state")}
        activeCellId={activeCellId}
        setActiveCellId={setActiveCellId}
        value={data.state}
        ariaLabel="State"
        editable={editable}
        onSave={(v) => onPatch({ state: v })}
      />
      {!breakViolationColumns && (
        <SummaryClickEditTextCell
          cellId={cell("wo")}
          activeCellId={activeCellId}
          setActiveCellId={setActiveCellId}
          value={data.wo}
          ariaLabel="Work order"
          editable={editable}
          onSave={(v) => onPatch({ wo: v })}
        />
      )}
      <SummaryClickEditTextCell
        cellId={cell("payRate")}
        activeCellId={activeCellId}
        setActiveCellId={setActiveCellId}
        value={data.payRate}
        ariaLabel="Pay rate"
        editable={editable}
        onSave={(v) => onPatch({ payRate: v })}
      />
      <SummaryClickEditNumberCell
        cellId={cell("reg")}
        activeCellId={activeCellId}
        setActiveCellId={setActiveCellId}
        value={data.reg ?? 0}
        ariaLabel="Regular hours"
        editable={hoursEditable}
        display={hoursMode === "dash" ? dash : hourCell(data.reg ?? 0, hourAlert, deleted)}
        onSave={(v) => onPatch({ reg: v })}
      />
      {!breakViolationColumns && (
        <>
          <SummaryClickEditNumberCell
            cellId={cell("ot")}
            activeCellId={activeCellId}
            setActiveCellId={setActiveCellId}
            value={data.ot ?? 0}
            ariaLabel="Overtime hours"
            editable={hoursEditable}
            display={hoursMode === "dash" ? dash : hourCell(data.ot ?? 0, hourAlert, deleted)}
            onSave={(v) => onPatch({ ot: v })}
          />
          <SummaryClickEditNumberCell
            cellId={cell("dt")}
            activeCellId={activeCellId}
            setActiveCellId={setActiveCellId}
            value={data.dt ?? 0}
            ariaLabel="Double time hours"
            editable={hoursEditable}
            display={hoursMode === "dash" ? dash : hourCell(data.dt ?? 0, false, deleted)}
            onSave={(v) => onPatch({ dt: v })}
          />
          <SummaryClickEditNumberCell
            cellId={cell("travel")}
            activeCellId={activeCellId}
            setActiveCellId={setActiveCellId}
            value={data.travel ?? 0}
            ariaLabel="Travel hours"
            editable={hoursEditable}
            display={hoursMode === "dash" ? dash : hourCell(data.travel ?? 0, false, deleted)}
            onSave={(v) => onPatch({ travel: v })}
          />
          <SummaryClickEditNumberCell
            cellId={cell("qty")}
            activeCellId={activeCellId}
            setActiveCellId={setActiveCellId}
            value={data.qty ?? 0}
            ariaLabel="Quantity"
            editable={hoursEditable}
            display={(data.qty ?? 0) > 0 ? (data.qty ?? 0) : "—"}
            onSave={(v) => onPatch({ qty: v })}
          />
        </>
      )}
      {!breakViolationColumns && (
        <SummaryClickEditNumberCell
          cellId={cell("perDiem")}
          activeCellId={activeCellId}
          setActiveCellId={setActiveCellId}
          value={data.perDiem ?? 0}
          ariaLabel="Per diem"
          editable={hoursEditable}
          display={(data.perDiem ?? 0) > 0 ? (data.perDiem ?? 0) : "—"}
          onSave={(v) => onPatch({ perDiem: v })}
        />
      )}
      {!breakViolationColumns && (
        <SummaryClickEditNumberCell
          cellId={cell("perDiemRate")}
          activeCellId={activeCellId}
          setActiveCellId={setActiveCellId}
          value={data.perDiemRate ?? 0}
          ariaLabel="Per diem rate"
          editable={hoursEditable}
          display={(data.perDiemRate ?? 0) > 0 ? (data.perDiemRate ?? 0) : "—"}
          onSave={(v) => onPatch({ perDiemRate: v })}
        />
      )}
      <SummaryClickEditTextCell
        cellId={cell("unionCode")}
        activeCellId={activeCellId}
        setActiveCellId={setActiveCellId}
        value={data.unionCode}
        ariaLabel="Union code"
        editable={editable}
        onSave={(v) => onPatch({ unionCode: v })}
      />
      <SummaryClickEditTextCell
        cellId={cell("wageCode")}
        activeCellId={activeCellId}
        setActiveCellId={setActiveCellId}
        value={data.wageCode}
        ariaLabel="Wage code"
        editable={editable}
        onSave={(v) => onPatch({ wageCode: v })}
      />
      <SummaryClickEditTextCell
        cellId={cell("rateLevel")}
        activeCellId={activeCellId}
        setActiveCellId={setActiveCellId}
        value={data.rateLevel}
        ariaLabel="Rate level"
        editable={editable}
        onSave={(v) => onPatch({ rateLevel: v })}
      />
      <SummaryClickEditTextCell
        cellId={cell("comment")}
        activeCellId={activeCellId}
        setActiveCellId={setActiveCellId}
        value={data.comment ?? ""}
        ariaLabel="Comment"
        editable={editable}
        display={data.comment?.trim() ? data.comment : "—"}
        onSave={(v) => onPatch({ comment: v })}
      />
    </>
  );
}

function SummaryBreakViolationTableColgroup() {
  return (
    <colgroup>
      <col style={{ width: SUMMARY_TABLE_ICON_COL_WIDTH }} />
      {BREAK_VIOLATION_TABLE_COL_WIDTHS.map((width, idx) => (
        <col key={BREAK_VIOLATION_TABLE_HEADERS[idx].title} style={{ width }} />
      ))}
    </colgroup>
  );
}

function SummaryBreakViolationTableHeaderRow() {
  return (
    <tr style={{ background: TABLE_HEADER_BG, borderBottom: `2px solid ${TABLE_HEADER_BORDER}` }}>
      <th className={SUMMARY_TABLE_CELL} style={{ borderBottom: `2px solid ${TABLE_HEADER_BORDER}` }} />
      {BREAK_VIOLATION_TABLE_HEADERS.map((h) => (
        <th
          key={h.title}
          title={h.title}
          className={SUMMARY_TABLE_CELL}
          style={{ borderBottom: `2px solid ${TABLE_HEADER_BORDER}` }}
        >
          <p className="text-[10px] font-semibold leading-[13px]" style={{ color: TABLE_HEADER_TEXT, fontFamily: OS }}>
            {h.label}
          </p>
        </th>
      ))}
    </tr>
  );
}

function SummaryTableColgroup() {
  return (
    <colgroup>
      <col style={{ width: SUMMARY_TABLE_ICON_COL_WIDTH }} />
      {SUMMARY_TABLE_COL_WIDTHS.map((width, idx) => (
        <col key={SUMMARY_TABLE_COLS[idx]} style={{ width }} />
      ))}
    </colgroup>
  );
}

function SummaryTableHeaderRow() {
  return (
    <tr style={{ background: TABLE_HEADER_BG, borderBottom: `2px solid ${TABLE_HEADER_BORDER}` }}>
      <th className={SUMMARY_TABLE_CELL} style={{ borderBottom: `2px solid ${TABLE_HEADER_BORDER}` }} />
      {SUMMARY_TABLE_HEADERS.map((h) => (
        <th
          key={h.title}
          title={h.title}
          className={SUMMARY_TABLE_CELL}
          style={{ borderBottom: `2px solid ${TABLE_HEADER_BORDER}` }}
        >
          <p className="text-[10px] font-semibold leading-[13px]" style={{ color: TABLE_HEADER_TEXT, fontFamily: OS }}>
            {h.label}
          </p>
        </th>
      ))}
    </tr>
  );
}

function BreakLineSegment({
  rowBackground,
  label,
  colSpan = 1,
}: {
  rowBackground: string;
  label?: ReactNode;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={BREAK_ROW_CELL}
      style={{ fontFamily: OS, border: "none" }}
    >
      <div className="relative flex min-h-[24px] w-full items-center">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-[#252a2e]" aria-hidden />
        {label ? (
          <span
            className="relative mx-auto inline-flex items-center gap-[4px] px-[8px] text-[11px] font-medium text-[#252a2e] whitespace-nowrap"
            style={{ background: rowBackground }}
          >
            {label}
          </span>
        ) : null}
      </div>
    </td>
  );
}

function SummaryBreakDataCells({
  rowId,
  data,
  rowBackground,
  activeCellId,
  setActiveCellId,
  onPatch,
}: {
  rowId: string;
  data: SummaryBreakRow;
  rowBackground: string;
  activeCellId: string | null;
  setActiveCellId: (id: string | null) => void;
  onPatch: (patch: SummaryRowPatch) => void;
}) {
  const cell = (field: string) => summaryCellId("break", rowId, field);

  return (
    <>
      <BreakLineSegment
        rowBackground={rowBackground}
        colSpan={7}
        label={<Coffee size={12} aria-hidden />}
      />
      <SummaryClickEditTextCell
        cellId={cell("start")}
        activeCellId={activeCellId}
        setActiveCellId={setActiveCellId}
        value={data.start}
        ariaLabel="Break start time"
        cellClassName={BREAK_ROW_CELL}
        className="text-center"
        onSave={(v) => onPatch({ start: v })}
      />
      <SummaryClickEditTextCell
        cellId={cell("end")}
        activeCellId={activeCellId}
        setActiveCellId={setActiveCellId}
        value={data.end}
        ariaLabel="Break end time"
        cellClassName={BREAK_ROW_CELL}
        className="text-center"
        onSave={(v) => onPatch({ end: v })}
      />
      <BreakLineSegment rowBackground={rowBackground} colSpan={6} label="Break" />
      <td className={`${BREAK_ROW_CELL} text-center`} style={{ fontFamily: OS, border: "none" }}>
        {data.duration > 0 ? (
          <span style={{ color: "#d97706", fontWeight: 600 }}>
            {data.duration.toFixed(2)}
          </span>
        ) : null}
      </td>
      <BreakLineSegment rowBackground={rowBackground} colSpan={10} />
    </>
  );
}

function SummaryViolationRow({
  violation: v,
  employee,
  stripeIdx,
  activeCellId,
  setActiveCellId,
  canDeleteBreakViolations,
  onApproveViolation,
  onDeleteViolation,
  onUpdateEmployee,
  onUpdateViolation,
}: {
  violation: SummaryViolation;
  employee: SummaryEmployee;
  stripeIdx: number;
  activeCellId: string | null;
  setActiveCellId: (id: string | null) => void;
  canDeleteBreakViolations: boolean;
  onApproveViolation: (violationId: string) => void;
  onDeleteViolation: (violationId: string, label: string) => void;
  onUpdateEmployee: (patch: Partial<Pick<SummaryEmployee, "name" | "employeeNum">>) => void;
  onUpdateViolation: (violationId: string, patch: SummaryRowPatch) => void;
}) {
  const row: SummaryTableRow = { kind: "violation", data: v };
  const isDeleted = v.status === "deleted";
  const isApproved = v.status === "approved" || !!v.approvedBy;
  const breakViolation = isBreakViolation(v);
  const canDelete = canDeleteBreakViolations && breakViolation && !isDeleted;
  const statusMark = (done: boolean) =>
    done ? <Check size={12} color="#15803d" /> : <span style={{ color: "#a3a3a3" }}>—</span>;

  return (
    <tr
      key={v.id}
      style={{
        background: summaryRowBackground(row, stripeIdx),
        borderBottom: summaryRowBorder(row),
        opacity: isDeleted ? 0.92 : 1,
      }}
    >
      <td className={`${SUMMARY_TABLE_CELL} text-center`}>
        {breakViolation ? (
          <div className="inline-flex flex-col items-center gap-[1px]" aria-label={isDeleted ? "Deleted break violation" : "Break violation"}>
            <Coffee size={13} color={isDeleted ? "#a3a3a3" : "#92400e"} aria-hidden />
            {isDeleted ? <X size={14} color="#a3a3a3" aria-hidden /> : <AlertTriangle size={16} color="#d97706" aria-hidden />}
          </div>
        ) : isDeleted ? (
          <X size={14} color="#a3a3a3" aria-hidden />
        ) : (
          <AlertTriangle size={16} color="#d97706" aria-hidden />
        )}
      </td>
      <SummaryEditableDataCells
        rowKind="violation"
        rowId={v.id}
        employee={employee}
        data={v}
        activeCellId={activeCellId}
        setActiveCellId={setActiveCellId}
        onPatch={(patch) => onUpdateViolation(v.id, patch)}
        onEmployeePatch={onUpdateEmployee}
        editable={!isDeleted}
        deleted={isDeleted}
        hourAlert
        columnsMode="breakViolation"
        approvedByCell={isDeleted ? (
          <span style={{ color: "#a3a3a3" }}>—</span>
        ) : isApproved ? undefined : (
          <StyledCheckbox
            checked={false}
            ariaLabel="Approve violation"
            onChange={() => onApproveViolation(v.id)}
          />
        )}
        secondApprovedByCell={!isDeleted && (isApproved || v.secondApprovedBy) ? undefined : isDeleted ? (
          <span style={{ color: "#a3a3a3" }}>—</span>
        ) : (
          <StyledCheckbox checked={false} onChange={() => {}} />
        )}
        completeCell={statusMark(isApproved && !isDeleted)}
        exportedCell={statusMark(v.exported)}
        afterExportedCell={
          <div className="flex flex-wrap items-center gap-[6px] min-w-0">
            {isDeleted ? (
              <ModusWcBadge color="secondary" variant="outlined" size="sm">Deleted</ModusWcBadge>
            ) : (
              <>
                <ModusWcBadge color="secondary" variant="filled" size="sm">
                  {breakViolationDisplayLabel(v)}
                </ModusWcBadge>
                {canDelete && (
                  <ModusWcButton
                    color="tertiary"
                    variant="borderless"
                    size="sm"
                    shape="square"
                    aria-label={`Delete break violation: ${v.label}`}
                    onButtonClick={() => onDeleteViolation(v.id, v.label)}
                  >
                    <ModusWcIcon name="delete" variant="outlined" size="xs" decorative />
                  </ModusWcButton>
                )}
              </>
            )}
          </div>
        }
      />
    </tr>
  );
}

function EmployeeSummarySection({
  title,
  trailing,
  children,
}: {
  title: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 w-full border-t border-[#e0e1e9]">
      <div className="flex flex-wrap items-center justify-between gap-[8px] px-[12px] py-[10px] bg-[#f8f9fb] border-b border-[#e0e1e9]">
        <p className="text-[13px] font-bold text-[#252a2e]" style={{ fontFamily: OS }}>{title}</p>
        {trailing ? (
          <div className="flex flex-wrap items-center gap-[8px]">{trailing}</div>
        ) : null}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

const EXPENSE_TABLE_CELL = "px-[4px] py-[6px] text-[11px] min-w-0 align-top break-words";
const EXPENSE_TABLE_HEADERS: { label: string; title: string }[] = [
  { label: "Appr. By", title: "Approved By" },
  { label: "2nd Appr.", title: "Second Approved By" },
  { label: "Exported", title: "Exported" },
  { label: "Date", title: "Date" },
  { label: "Dept", title: "Department" },
  { label: "Job", title: "Job" },
  { label: "Phase", title: "Phase" },
  { label: "Name", title: "Name" },
  { label: "Category", title: "Category" },
  { label: "Vendor", title: "Vendor" },
  { label: "Total", title: "Total" },
  { label: "Added By", title: "Added By" },
  { label: "Attach.", title: "Attachments" },
  { label: "Comment", title: "Comment" },
];

function SummaryExpensesTable({ expenses }: { expenses: SummaryExpense[] }) {
  const total = expenses.reduce((sum, row) => sum + row.total, 0);
  const statusMark = (done: boolean) =>
    done ? <Check size={12} color="#15803d" /> : <span style={{ color: "#a3a3a3" }}>—</span>;

  return (
    <table className="w-full min-w-[960px] border-collapse" style={{ tableLayout: "fixed" }}>
      <thead>
        <tr style={{ background: TABLE_HEADER_BG, borderBottom: `2px solid ${TABLE_HEADER_BORDER}` }}>
          {EXPENSE_TABLE_HEADERS.map((h) => (
            <th
              key={h.title}
              title={h.title}
              className={EXPENSE_TABLE_CELL}
              style={{ borderBottom: `2px solid ${TABLE_HEADER_BORDER}` }}
            >
              <p className="text-[10px] font-semibold leading-[13px]" style={{ color: TABLE_HEADER_TEXT, fontFamily: OS }}>
                {h.label}
              </p>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {expenses.length === 0 ? (
          <tr style={{ background: "#ffffff", borderBottom: "1px solid #e0e1e9" }}>
            <td colSpan={EXPENSE_TABLE_HEADERS.length} className={`${EXPENSE_TABLE_CELL} text-center text-[#6a6e79]`} style={{ fontFamily: OS }}>
              No expenses for this pay period
            </td>
          </tr>
        ) : (
          expenses.map((row, idx) => (
            <tr
              key={row.id}
              style={{
                background: row.approvedBy ? SUMMARY_APPROVED_ROW_BG : idx % 2 === 0 ? "#ffffff" : "#fafafa",
                borderBottom: row.approvedBy ? "1px solid #bbe6ca" : "1px solid #e0e1e9",
              }}
            >
              <td className={EXPENSE_TABLE_CELL} style={{ fontFamily: OS }}>
                {row.approvedBy ? (
                  <span className="inline-flex items-center gap-[4px]">
                    <Check size={12} color="#15803d" />
                    <span className="text-[10px] break-words">{row.approvedBy}</span>
                  </span>
                ) : (
                  <StyledCheckbox checked={false} onChange={() => {}} />
                )}
              </td>
              <td className={EXPENSE_TABLE_CELL} style={{ fontFamily: OS }}>
                {row.secondApprovedBy ? (
                  <span className="inline-flex items-center gap-[4px]">
                    <Check size={12} color="#15803d" />
                    <span className="text-[10px] break-words">{row.secondApprovedBy}</span>
                  </span>
                ) : (
                  <StyledCheckbox checked={false} onChange={() => {}} />
                )}
              </td>
              <td className={EXPENSE_TABLE_CELL} style={{ fontFamily: OS }}>{statusMark(row.exported)}</td>
              <td className={EXPENSE_TABLE_CELL} style={{ fontFamily: OS }}>{row.date}</td>
              <td className={EXPENSE_TABLE_CELL} style={{ fontFamily: OS }}>{row.dept}</td>
              <td className={EXPENSE_TABLE_CELL} style={{ fontFamily: OS }}>{row.job}</td>
              <td className={EXPENSE_TABLE_CELL} style={{ fontFamily: OS }}>{row.phase}</td>
              <td className={EXPENSE_TABLE_CELL} style={{ fontFamily: OS }}>{row.name}</td>
              <td className={EXPENSE_TABLE_CELL} style={{ fontFamily: OS }}>{row.category}</td>
              <td className={EXPENSE_TABLE_CELL} style={{ fontFamily: OS }}>{row.vendor}</td>
              <td className={EXPENSE_TABLE_CELL} style={{ fontFamily: OS }}>
                ${row.total.toFixed(2)}
              </td>
              <td className={EXPENSE_TABLE_CELL} style={{ fontFamily: OS }}>{row.addedBy}</td>
              <td className={EXPENSE_TABLE_CELL} style={{ fontFamily: OS }}>
                {row.attachments > 0 ? (
                  <span className="inline-flex items-center gap-[4px] text-[#0e416c]">
                    <Paperclip size={12} aria-hidden />
                    {row.attachments}
                  </span>
                ) : (
                  <span style={{ color: "#a3a3a3" }}>—</span>
                )}
              </td>
              <td className={EXPENSE_TABLE_CELL} style={{ fontFamily: OS }}>
                {row.comment?.trim() ? row.comment : "—"}
              </td>
            </tr>
          ))
        )}
        <tr style={{ background: "#f1f1f6", borderTop: "2px solid #e0e1e9" }}>
          <td colSpan={10} className={`${EXPENSE_TABLE_CELL} font-bold`} style={{ fontFamily: OS, color: "#252a2e" }}>
            Total
          </td>
          <td className={`${EXPENSE_TABLE_CELL} font-bold`} style={{ fontFamily: OS }}>
            ${total.toFixed(2)}
          </td>
          <td colSpan={3} />
        </tr>
      </tbody>
    </table>
  );
}

function SummaryEntryTable({
  employee,
  onUpdateEmployee,
  onUpdateEntry,
  onUpdateBreak,
}: {
  employee: SummaryEmployee;
  onUpdateEmployee: (patch: Partial<Pick<SummaryEmployee, "name" | "employeeNum">>) => void;
  onUpdateEntry: (entryId: string, patch: SummaryRowPatch) => void;
  onUpdateBreak: (breakId: string, patch: SummaryRowPatch) => void;
}) {
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const tableRows = buildSummaryTableRows(employee);

  const totals = {
    reg: employee.entries.reduce((s, e) => s + e.reg, 0),
    ot: employee.entries.reduce((s, e) => s + e.ot, 0),
    dt: employee.entries.reduce((s, e) => s + e.dt, 0),
    travel: employee.entries.reduce((s, e) => s + e.travel, 0),
    all: 0,
  };
  totals.all = totals.reg + totals.ot + totals.dt;

  return (
    <div className="min-w-0 w-full">
      <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
        <SummaryTableColgroup />
        <thead>
          <SummaryTableHeaderRow />
        </thead>
        <tbody>
          {tableRows.map((row, idx) => {
            const stripeIdx = summaryEntryStripeIndex(tableRows, idx);
            if (row.kind === "entry") {
              const entry = row.data;
              return (
                <tr key={entry.id} style={{ background: summaryRowBackground(row, stripeIdx), borderBottom: summaryRowBorder(row) }}>
                  <td className={`${SUMMARY_TABLE_CELL} text-center`}>
                    <div className="inline-flex items-center justify-center" aria-label="Work entry">
                      <Clock size={13} color="#6a6e79" aria-hidden />
                    </div>
                  </td>
                  <SummaryEditableDataCells
                    rowKind="entry"
                    rowId={entry.id}
                    employee={employee}
                    data={entry}
                    activeCellId={activeCellId}
                    setActiveCellId={setActiveCellId}
                    onPatch={(patch) => onUpdateEntry(entry.id, patch)}
                    onEmployeePatch={onUpdateEmployee}
                    hourAlert={entry.hourAlert}
                    jobHighlight={entry.jobHighlight}
                    phaseHighlight={entry.phaseHighlight}
                  />
                </tr>
              );
            }

            if (row.kind === "break") {
              const br = row.data;
              const rowBg = summaryRowBackground(row, stripeIdx);
              return (
                <tr key={br.id} className="summary-break-row" style={{ background: rowBg, borderBottom: "1px solid #e0e1e9" }}>
                  <td className={BREAK_ROW_CELL} style={{ border: "none" }}>
                    <div className="relative min-h-[24px]">
                      <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-[#252a2e]" aria-hidden />
                    </div>
                  </td>
                  <SummaryBreakDataCells
                    rowId={br.id}
                    data={br}
                    rowBackground={rowBg}
                    activeCellId={activeCellId}
                    setActiveCellId={setActiveCellId}
                    onPatch={(patch) => onUpdateBreak(br.id, patch)}
                  />
                </tr>
              );
            }

            return null;
          })}
          <tr style={{ background: "#f1f1f6", borderTop: "2px solid #e0e1e9" }}>
            <td colSpan={15} className={`${SUMMARY_TABLE_CELL} font-bold`} style={{ fontFamily: OS, color: "#252a2e" }}>
              Totals
            </td>
            <td className={`${SUMMARY_TABLE_CELL} font-bold`} style={{ fontFamily: OS }}>{totals.all.toFixed(2)}</td>
            <td className={`${SUMMARY_TABLE_CELL} font-bold`} style={{ fontFamily: OS }}>{totals.reg.toFixed(2)}</td>
            <td className={`${SUMMARY_TABLE_CELL} font-bold`} style={{ fontFamily: OS }}>{totals.ot.toFixed(2)}</td>
            <td className={`${SUMMARY_TABLE_CELL} font-bold`} style={{ fontFamily: OS }}>{totals.dt.toFixed(2)}</td>
            <td className={`${SUMMARY_TABLE_CELL} font-bold`} style={{ fontFamily: OS }}>{totals.travel.toFixed(2)}</td>
            <td colSpan={7} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SummaryBreakViolationsTable({
  employee,
  canDeleteBreakViolations,
  onApproveViolation,
  onDeleteViolation,
  onUpdateEmployee,
  onUpdateViolation,
}: {
  employee: SummaryEmployee;
  canDeleteBreakViolations: boolean;
  onApproveViolation: (violationId: string) => void;
  onDeleteViolation: (violationId: string, label: string) => void;
  onUpdateEmployee: (patch: Partial<Pick<SummaryEmployee, "name" | "employeeNum">>) => void;
  onUpdateViolation: (violationId: string, patch: SummaryRowPatch) => void;
}) {
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const violationRows = buildBreakViolationRows(employee);

  const activeViolations = violationRows.filter((v) => v.status !== "deleted");
  const totals = {
    reg: activeViolations.reduce((s, v) => s + v.reg, 0),
    ot: activeViolations.reduce((s, v) => s + v.ot, 0),
    dt: activeViolations.reduce((s, v) => s + v.dt, 0),
    travel: activeViolations.reduce((s, v) => s + v.travel, 0),
    all: 0,
  };
  totals.all = totals.reg + totals.ot + totals.dt;

  return (
    <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
      <SummaryBreakViolationTableColgroup />
      <thead>
        <SummaryBreakViolationTableHeaderRow />
      </thead>
      <tbody>
        {violationRows.length === 0 ? (
          <tr style={{ background: "#ffffff", borderBottom: "1px solid #e0e1e9" }}>
            <td colSpan={BREAK_VIOLATION_TABLE_COL_COUNT} className={`${SUMMARY_TABLE_CELL} text-center text-[#6a6e79]`} style={{ fontFamily: OS }}>
              No violations for this pay period
            </td>
          </tr>
        ) : (
          violationRows.map((v, idx) => (
            <SummaryViolationRow
              key={v.id}
              violation={v}
              employee={employee}
              stripeIdx={idx}
              activeCellId={activeCellId}
              setActiveCellId={setActiveCellId}
              canDeleteBreakViolations={canDeleteBreakViolations}
              onApproveViolation={onApproveViolation}
              onDeleteViolation={onDeleteViolation}
              onUpdateEmployee={onUpdateEmployee}
              onUpdateViolation={onUpdateViolation}
            />
          ))
        )}
        <tr style={{ background: "#f1f1f6", borderTop: "2px solid #e0e1e9" }}>
          <td colSpan={13} className={`${SUMMARY_TABLE_CELL} font-bold`} style={{ fontFamily: OS, color: "#252a2e" }}>
            Totals
          </td>
          <td className={`${SUMMARY_TABLE_CELL} font-bold`} style={{ fontFamily: OS }}>{totals.all.toFixed(2)}</td>
          <td className={`${SUMMARY_TABLE_CELL} font-bold`} style={{ fontFamily: OS }}>{totals.reg.toFixed(2)}</td>
          <td colSpan={4} />
        </tr>
      </tbody>
    </table>
  );
}


function EmployeeSummaryCard({
  employee,
  canDeleteBreakViolations,
  onApproveViolation,
  onDeleteViolation,
  onApproveAll,
  onUpdateEmployee,
  onUpdateEntry,
  onUpdateBreak,
  onUpdateViolation,
}: {
  employee: SummaryEmployee;
  canDeleteBreakViolations: boolean;
  onApproveViolation: (violationId: string) => void;
  onDeleteViolation: (violationId: string, label: string) => void;
  onApproveAll?: () => void;
  onUpdateEmployee: (patch: Partial<Pick<SummaryEmployee, "name" | "employeeNum">>) => void;
  onUpdateEntry: (entryId: string, patch: SummaryRowPatch) => void;
  onUpdateBreak: (breakId: string, patch: SummaryRowPatch) => void;
  onUpdateViolation: (violationId: string, patch: SummaryRowPatch) => void;
}) {
  const [attested, setAttested] = useState<Set<number>>(new Set());
  const entryRegTotal = employee.entries.reduce((sum, entry) => sum + entry.reg, 0);
  const expenseTotal = employee.expenses.reduce((sum, row) => sum + row.total, 0);
  const violationCount = buildBreakViolationRows(employee).length;

  return (
    <div className="mb-[16px] rounded-[8px] border border-[#e0e1e9] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-[12px] px-[16px] py-[14px] border-b border-[#f0f0f4]">
        <div className="flex items-center gap-[12px]">
          <div className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
            style={{ background: "#252a2e", color: "#ffffff", fontFamily: OS }}>
            {employee.initials}
          </div>
          <div>
            <p className="text-[15px] font-bold text-[#252a2e]" style={{ fontFamily: OS }}>{employee.name}</p>
            <p className="text-[12px] text-[#6a6e79]" style={{ fontFamily: OS }}>{employee.initials} {employee.employeeNum}</p>
          </div>
        </div>
        {onApproveAll && (
          <ModusWcButton color="primary" variant="outlined" size="sm" onButtonClick={onApproveAll}>
            Approve All {employee.name.split(" ")[0]}&apos;s Entries
          </ModusWcButton>
        )}
      </div>
      <AttestationPanel
        days={employee.attestationDays}
        attested={attested}
        onAttest={(date) => setAttested((prev) => new Set([...prev, date]))}
      />
      <EmployeeSummarySection
        title="Timesheet Entries"
        trailing={(
          <>
            <ModusWcButton color="tertiary" variant="outlined" size="sm" onButtonClick={() => toast.message("Refreshing timesheet…")}>
              Refresh
            </ModusWcButton>
            <span className="text-[12px] font-semibold text-[#252a2e]" style={{ fontFamily: OS }}>
              Total Reg {entryRegTotal.toFixed(2)}
            </span>
          </>
        )}
      >
        <SummaryEntryTable
          employee={employee}
          onUpdateEmployee={onUpdateEmployee}
          onUpdateEntry={onUpdateEntry}
          onUpdateBreak={onUpdateBreak}
        />
      </EmployeeSummarySection>
      <EmployeeSummarySection
        title="Violations"
        trailing={violationCount > 0 ? (
          <>
            <ModusWcBadge color="warning" variant="filled" size="sm">{violationCount}</ModusWcBadge>
            <span className="text-[12px] font-semibold text-[#92400e]" style={{ fontFamily: OS }}>
              Review required
            </span>
          </>
        ) : (
          <span className="text-[12px] text-[#6a6e79]" style={{ fontFamily: OS }}>None</span>
        )}
      >
        <SummaryBreakViolationsTable
          employee={employee}
          canDeleteBreakViolations={canDeleteBreakViolations}
          onApproveViolation={onApproveViolation}
          onDeleteViolation={onDeleteViolation}
          onUpdateEmployee={onUpdateEmployee}
          onUpdateViolation={onUpdateViolation}
        />
      </EmployeeSummarySection>
      <EmployeeSummarySection
        title="Expenses"
        trailing={(
          <span className="text-[12px] font-semibold text-[#252a2e]" style={{ fontFamily: OS }}>
            Total ${expenseTotal.toFixed(2)}
          </span>
        )}
      >
        <SummaryExpensesTable expenses={employee.expenses} />
      </EmployeeSummarySection>
    </div>
  );
}

function TimesheetSummary() {
  const { canDeleteBreakViolations, viewerLabel } = useViewingRole();
  const [employees, setEmployees] = useState<SummaryEmployee[]>(SUMMARY_MOCK_EMPLOYEES);
  const [deleteTarget, setDeleteTarget] = useState<{
    empId: string;
    violationId: string;
    label: string;
    isBreakViolation: boolean;
  } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const updateViolation = (empId: string, violationId: string, patch: Partial<SummaryViolation>) => {
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id !== empId
          ? emp
          : {
              ...emp,
              violations: emp.violations.map((v) =>
                v.id === violationId ? { ...v, ...patch } : v,
              ),
            },
      ),
    );
  };

  const updateEntry = (empId: string, entryId: string, patch: SummaryRowPatch) => {
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id !== empId
          ? emp
          : {
              ...emp,
              entries: emp.entries.map((entry) =>
                entry.id === entryId ? { ...entry, ...patch } : entry,
              ),
            },
      ),
    );
  };

  const updateBreak = (empId: string, breakId: string, patch: SummaryRowPatch) => {
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id !== empId
          ? emp
          : {
              ...emp,
              breaks: emp.breaks.map((br) =>
                br.id === breakId ? { ...br, ...patch } : br,
              ),
            },
      ),
    );
  };

  const updateEmployeeMeta = (empId: string, patch: Partial<Pick<SummaryEmployee, "name" | "employeeNum">>) => {
    setEmployees((prev) =>
      prev.map((emp) => (emp.id !== empId ? emp : { ...emp, ...patch })),
    );
  };

  const approveViolation = (empId: string, violationId: string) => {
    updateViolation(empId, violationId, {
      status: "approved",
      approvedBy: "Luc Peron",
      secondApprovedBy: "Luc Peron",
      complete: true,
    });
    toast.success("Violation approved — premium pay row confirmed.");
  };

  const confirmDelete = (comment: string) => {
    if (!deleteTarget) return;
    updateViolation(deleteTarget.empId, deleteTarget.violationId, {
      status: "deleted",
      deletionComment: comment,
      deletedBy: viewerLabel,
      comment,
      approvedBy: undefined,
      secondApprovedBy: undefined,
      complete: false,
    });
    setDeleteTarget(null);
    toast.success("Break violation deleted — row retained on timesheet for audit.");
  };

  const approveAllForEmployee = (empId: string) => {
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id !== empId
          ? emp
          : {
              ...emp,
              entries: emp.entries.map((entry) => ({
                ...entry,
                approvedBy: entry.approvedBy ?? "Luc Peron",
                secondApprovedBy: entry.secondApprovedBy ?? "Luc Peron",
                complete: true,
              })),
              breaks: emp.breaks.map((br) => ({
                ...br,
                approvedBy: br.approvedBy ?? "Luc Peron",
                secondApprovedBy: br.secondApprovedBy ?? "Luc Peron",
                complete: true,
              })),
              violations: emp.violations.map((v) =>
                v.status === "pending"
                  ? {
                      ...v,
                      status: "approved" as ViolationRowStatus,
                      approvedBy: "Luc Peron",
                      secondApprovedBy: "Luc Peron",
                      complete: true,
                    }
                  : v,
              ),
            },
      ),
    );
    toast.success("All entries approved for this employee.");
  };

  const grandTotals = employees.reduce(
    (acc, emp) => {
      emp.entries.forEach((e) => {
        acc.reg += e.reg;
        acc.ot += e.ot;
        acc.dt += e.dt;
        acc.travel += e.travel;
        acc.qty += e.qty;
        acc.perDiem += e.perDiem;
      });
      emp.violations.filter((v) => v.status !== "deleted").forEach((v) => {
        acc.reg += v.reg;
        acc.ot += v.ot;
        acc.dt += v.dt;
        acc.travel += v.travel;
        acc.qty += v.qty;
        acc.perDiem += v.perDiem;
      });
      emp.expenses.forEach((expense) => {
        acc.expenses += expense.total;
      });
      return acc;
    },
    { reg: 0, ot: 0, dt: 0, travel: 0, qty: 0, perDiem: 0, expenses: 0 },
  );

  const violationCount = employees.reduce((n, emp) => n + emp.violations.length, 0);

  return (
    <div className="min-h-screen p-[24px] min-w-0" style={{ background: "#f1f1f6" }}>
      {deleteTarget && (
        <ViolationRemoveModal
          premiumLabel={deleteTarget.label}
          isBreakViolation={deleteTarget.isBreakViolation}
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      <div className="mb-[16px] flex flex-wrap items-start justify-between gap-[12px]">
        <div>
          <p className="font-bold text-[18px] leading-[27px]" style={{ color: "#000000", fontFamily: OS, ...OS_FVS }}>
            Timesheet Summary
          </p>
          <p className="font-semibold text-[12px] leading-[16px] mt-[4px]" style={{ color: "#6a6e79", fontFamily: OS, ...OS_FVS }}>
            Aug 15th – Aug 21st, 2026
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-[8px]">
          <ModusWcButton color="primary" variant="filled" size="sm" onButtonClick={() => toast.message("Timesheet list")}>
            <ModusWcIcon name="chevron_left" variant="outlined" size="xs" decorative />
            Timesheet List
          </ModusWcButton>
          <ModusWcButton color="tertiary" variant="outlined" size="sm" onButtonClick={() => toast.message("Exports")}>
            <ModusWcIcon name="export" variant="outlined" size="xs" decorative />
            Exports
            <ModusWcIcon name="caret_down" variant="outlined" size="xs" decorative />
          </ModusWcButton>
          <ModusWcButton color="tertiary" variant="outlined" size="sm" onButtonClick={() => toast.message("Expenses")}>
            <ModusWcIcon name="payment_instant" variant="outlined" size="xs" decorative />
            Expenses
            <ModusWcBadge color="primary" size="sm" variant="filled">0</ModusWcBadge>
          </ModusWcButton>
          <ModusWcButton color="tertiary" variant="outlined" size="sm" onButtonClick={() => toast.message("Missing report")}>
            <ModusWcIcon name="list_bulleted" variant="outlined" size="xs" decorative />
            Missing Timesheets Report
          </ModusWcButton>
          <ModusWcButton color="tertiary" variant="outlined" size="sm" onButtonClick={() => toast.message("Print")}>
            <ModusWcIcon name="print" variant="outlined" size="xs" decorative />
            Print
          </ModusWcButton>
        </div>
      </div>

      <div className="mb-[12px] rounded-[8px] overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between px-[16px] py-[10px]" style={{ background: "#0e416c", minHeight: 44 }}>
          <p className="font-semibold text-[14px] text-white" style={{ fontFamily: OS }}>Filters</p>
          <button type="button" onClick={() => setFiltersOpen((v) => !v)} className="text-white/80 hover:text-white" aria-label="Toggle filters">
            <AlignJustify size={16} />
          </button>
        </div>
        {filtersOpen && (
          <div className="bg-white px-[16px] py-[14px] border-b border-[#e0e1e9]">
            <div className="flex flex-wrap gap-[8px]">
              <FilterInput placeholder="Employee" value="" onChange={() => {}} options={employees.map((e) => e.name)} />
              <FilterInput placeholder="Department" value="" onChange={() => {}} options={["Main Orders"]} />
              <FilterInput placeholder="Job" value="" onChange={() => {}} />
            </div>
          </div>
        )}
        <div className="flex items-center gap-[8px] px-[16px] py-[10px] bg-white border-b border-[#e0e1e9]">
          <Check size={14} color="#15803d" />
          <p className="text-[12px] font-semibold text-[#15803d]" style={{ fontFamily: OS }}>All Employees Loaded</p>
          {violationCount > 0 && (
            <ModusWcBadge color="warning" variant="filled" size="sm" customClass="ml-[8px]">
              {violationCount} row{violationCount !== 1 ? "s" : ""} with compliance violations
            </ModusWcBadge>
          )}
        </div>
      </div>

      {employees.map((emp) => (
        <EmployeeSummaryCard
          key={emp.id}
          employee={emp}
          canDeleteBreakViolations={canDeleteBreakViolations}
          onApproveViolation={(violationId) => approveViolation(emp.id, violationId)}
          onDeleteViolation={(violationId, label) => {
            const violation = emp.violations.find((v) => v.id === violationId);
            if (!canDeleteBreakViolations) {
              toast.error("Only administrators can delete break violations.");
              return;
            }
            if (!violation || !isBreakViolation(violation)) return;
            setDeleteTarget({
              empId: emp.id,
              violationId,
              label,
              isBreakViolation: true,
            });
          }}
          onApproveAll={emp.id === "emp-connor" ? () => approveAllForEmployee(emp.id) : undefined}
          onUpdateEmployee={(patch) => updateEmployeeMeta(emp.id, patch)}
          onUpdateEntry={(entryId, patch) => updateEntry(emp.id, entryId, patch)}
          onUpdateBreak={(breakId, patch) => updateBreak(emp.id, breakId, patch)}
          onUpdateViolation={(violationId, patch) => updateViolation(emp.id, violationId, patch)}
        />
      ))}

      <div className="rounded-[8px] border border-[#e0e1e9] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-[20px] py-[14px] border-b border-[#f0f0f4]">
          <p className="text-[15px] font-bold text-[#0e416c]" style={{ fontFamily: OS }}>Grand Totals</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-[16px] px-[20px] py-[16px]">
          {[
            { label: "Employees", value: String(employees.length) },
            { label: "Regular Hours", value: String(grandTotals.reg) },
            { label: "Overtime Hours", value: String(grandTotals.ot) },
            { label: "Double Time Hours", value: String(grandTotals.dt) },
            { label: "Travel Hours", value: String(grandTotals.travel) },
            { label: "Quantity Total", value: String(grandTotals.qty) },
            { label: "Per Diem (days)", value: String(grandTotals.perDiem) },
            { label: "Expenses Total", value: `$${grandTotals.expenses.toFixed(2)}` },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-[11px] text-[#6a6e79] mb-[4px]" style={{ fontFamily: OS }}>{item.label}</p>
              <p className="text-[20px] font-bold text-[#252a2e]" style={{ fontFamily: OS }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────
function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const [tenant, setTenant] = useState("enterprise");
  const { viewingAs, setViewingAs } = useViewingRole();
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
          <span className="text-[11px] font-black text-white">T</span>
        </div>
        <span className="text-[14px] font-bold text-[#0d3560] whitespace-nowrap">Traqspera</span>
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
          onInputChange={(e) => setViewingAs(e.target.value as ViewingRole)}
          style={{ width: 200 }}
        />
        <button className="flex h-[32px] w-[32px] items-center justify-center rounded-full text-[#6a6e79] hover:text-[#252a2e] hover:bg-[#f1f1f6] transition-colors">
          <Bell size={15} />
        </button>
        <button className="flex h-[32px] w-[32px] items-center justify-center rounded-full text-[#6a6e79] hover:text-[#252a2e] hover:bg-[#f1f1f6] transition-colors">
          <HelpCircle size={15} />
        </button>
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#252a2e] text-white text-[11px] font-bold cursor-pointer">
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
                    <span className="flex-1 text-left text-[13px] font-semibold text-white whitespace-nowrap">
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
                        <span className="text-[12px]"
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
  { key: "s_settings",           label: "Settings",               icon: <Settings size={17} /> },
  { key: "s_permissions",        label: "Permissions",            icon: <Shield size={17} /> },
  { key: "s_time_off_setup",     label: "Time Off Setup",         icon: <Clock size={17} /> },
  { key: "s_notifications",      label: "Notifications",          icon: <AlignJustify size={17} /> },
  { key: "s_tenant_images",      label: "Tenant Images",          icon: <FileText size={17} /> },
  { key: "s_hour_rules",         label: "Hour Rules",             icon: <Filter size={17} /> },
  { key: "s_timesheet_settings", label: "Timesheet Settings",     icon: <ClipboardList size={17} /> },
  { key: "s_rate_level",         label: "Rate Level",             icon: <BarChart2 size={17} /> },
  { key: "s_auto_job",           label: "Automatic Job Settings", icon: <Wrench size={17} /> },
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
                <span className="text-[14px] leading-[19px]"
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
        <p className="text-[16px] font-bold text-[#252a2e]">{title}</p>
        <p className="mt-[4px] text-[12px] text-[#6a6e79]">This page is under construction.</p>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [activePage, setActivePage] = useState<NavPage>("s_hour_rules");
  const [navCollapsed, setNavCollapsed] = useState(true);
  const [attestationQuestions, setAttestationQuestions] = useState<AttestationQuestion[]>(defaultAttestationQuestions);
  const [companyMealPenalty, setCompanyMealPenalty] = useState<MealPenaltyState>(() => ({
    ...defaultMealPenalty(),
    breakType: "premium",
    penaltiesEnabled: true,
  }));
  const [viewingAs, setViewingAs] = useState<ViewingRole>("admin");
  const inSettings = SETTINGS_PAGES.has(activePage);
  const navW = navCollapsed ? NAV_COLLAPSED_W : NAV_EXPANDED_W;

  const contentLeft = navW + (inSettings ? SETTINGS_NAV_W + 16 : 0);

  const viewingRoleValue: ViewingRoleContextValue = {
    viewingAs,
    setViewingAs,
    canDeleteBreakViolations: viewingAs === "admin",
    viewerLabel: VIEWING_ROLE_LABELS[viewingAs],
  };

  const openAttestationQuestions = useCallback(() => {
    setActivePage("s_timesheet_settings");
    window.setTimeout(() => {
      document.getElementById("attestation-questions")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }, []);

  return (
    <ViewingRoleContext.Provider value={viewingRoleValue}>
    <MealPenaltyConfigContext.Provider value={{ companyMealPenalty, setCompanyMealPenalty }}>
    <AttestationConfigContext.Provider value={{ questions: attestationQuestions, setQuestions: setAttestationQuestions }}>
    <div className="min-h-screen font-sans bg-[var(--modus-wc-color-base-page,#f1f1f6)]">
      <Toaster position="top-right" richColors />
      <TopBar onMenuClick={() => setNavCollapsed((v) => !v)} />
      <NavSidebar
        activePage={activePage}
        onNavigate={setActivePage}
        collapsed={navCollapsed}
        onToggleCollapse={() => setNavCollapsed((v) => !v)}
      />
      {inSettings && <SettingsSubNav activePage={activePage} onNavigate={setActivePage} navW={navW} />}
      <div className="min-w-0" style={{ marginLeft: contentLeft, marginTop: TOP_BAR_H, minHeight: `calc(100vh - ${TOP_BAR_H}px)` }}>
        {/* Time */}
        {activePage === "timesheets"        && <PlaceholderPage title="Timesheets" />}
        {activePage === "clock_in"          && <ClockInOutPage />}
        {activePage === "timesheet_summary" && <TimesheetSummary />}
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
        {activePage === "s_hour_rules"          && (
          <JurisdictionSettings onOpenAttestationQuestions={openAttestationQuestions} />
        )}
        {activePage === "s_timesheet_settings"  && <TimesheetSettings />}
        {activePage === "s_settings"            && <PlaceholderPage title="Settings" />}
        {activePage === "s_permissions"     && <PlaceholderPage title="Permissions" />}
        {activePage === "s_time_off_setup"  && <PlaceholderPage title="Time Off Setup" />}
        {activePage === "s_notifications"   && <PlaceholderPage title="Notifications" />}
        {activePage === "s_tenant_images"   && <PlaceholderPage title="Tenant Images" />}
        {activePage === "s_rate_level"      && <PlaceholderPage title="Rate Level" />}
        {activePage === "s_auto_job"        && <PlaceholderPage title="Automatic Job Settings" />}
      </div>
    </div>
    </AttestationConfigContext.Provider>
    </MealPenaltyConfigContext.Provider>
    </ViewingRoleContext.Provider>
  );
}
