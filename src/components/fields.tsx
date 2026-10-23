"use client";

import { useId, useState, type ReactNode } from "react";

type Options = readonly (readonly [string, string])[];

type BaseProps = {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  disabled?: boolean;
  className?: string;
};

export function Field({ label, required, hint, error, className, htmlFor, children }: BaseProps & { htmlFor?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-red-500" aria-hidden>*</span>}
      </label>
      {children}
      {hint && !error && <p className="hint">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  type = "text",
  placeholder,
  list,
  ...base
}: BaseProps & { value: string; onChange: (v: string) => void; type?: string; placeholder?: string; list?: string }) {
  const id = useId();
  return (
    <Field {...base} htmlFor={id}>
      <input
        id={id}
        type={type}
        list={list}
        className={`input ${base.error ? "input-error" : ""}`}
        value={value}
        placeholder={placeholder}
        disabled={base.disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
  ...base
}: BaseProps & { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  const id = useId();
  return (
    <Field {...base} htmlFor={id}>
      <textarea
        id={id}
        rows={rows}
        className={`input ${base.error ? "input-error" : ""}`}
        value={value}
        placeholder={placeholder}
        disabled={base.disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Seleccione…",
  ...base
}: BaseProps & { value: string; onChange: (v: string) => void; options: Options; placeholder?: string }) {
  const id = useId();
  return (
    <Field {...base} htmlFor={id}>
      <select
        id={id}
        className={`input ${base.error ? "input-error" : ""}`}
        value={value}
        disabled={base.disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function RadioGroup({
  value,
  onChange,
  options,
  columns = 1,
  ...base
}: BaseProps & { value: string; onChange: (v: string) => void; options: Options; columns?: 1 | 2 | 3 }) {
  const name = useId();
  const grid = columns === 3 ? "sm:grid-cols-3" : columns === 2 ? "sm:grid-cols-2" : "";
  return (
    <Field {...base}>
      <div className={`grid gap-2 ${grid}`} role="radiogroup">
        {options.map(([v, l]) => (
          <label
            key={v}
            className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition ${
              value === v ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:border-slate-300"
            } ${base.disabled ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <input
              type="radio"
              name={name}
              className="mt-0.5 accent-brand-600"
              checked={value === v}
              disabled={base.disabled}
              onChange={() => onChange(v)}
            />
            <span>{l}</span>
          </label>
        ))}
      </div>
    </Field>
  );
}

export function CheckboxGroup({
  values,
  onChange,
  options,
  columns = 2,
  ...base
}: BaseProps & { values: string[]; onChange: (v: string[]) => void; options: Options; columns?: 1 | 2 | 3 }) {
  const grid = columns === 3 ? "sm:grid-cols-3" : columns === 2 ? "sm:grid-cols-2" : "";
  const toggle = (v: string) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <Field {...base}>
      <div className={`grid gap-2 ${grid}`}>
        {options.map(([v, l]) => (
          <label
            key={v}
            className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition ${
              values.includes(v) ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:border-slate-300"
            } ${base.disabled ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <input
              type="checkbox"
              className="mt-0.5 accent-brand-600"
              checked={values.includes(v)}
              disabled={base.disabled}
              onChange={() => toggle(v)}
            />
            <span>{l}</span>
          </label>
        ))}
      </div>
    </Field>
  );
}

export function YesNo({
  value,
  onChange,
  ...base
}: BaseProps & { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <RadioGroup
      {...base}
      columns={2}
      value={value === null ? "" : value ? "SI" : "NO"}
      onChange={(v) => onChange(v === "SI")}
      options={[
        ["SI", "Sí"],
        ["NO", "No"],
      ]}
    />
  );
}

export function TagsInput({
  values,
  onChange,
  placeholder = "Escriba y presione Enter",
  suggestions = [],
  ...base
}: BaseProps & { values: string[]; onChange: (v: string[]) => void; placeholder?: string; suggestions?: string[] }) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const v = raw.trim();
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setDraft("");
  };
  return (
    <Field {...base} htmlFor={id}>
      <div className={`input flex flex-wrap items-center gap-1.5 ${base.error ? "input-error" : ""} ${base.disabled ? "bg-slate-100" : ""}`}>
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
            {v}
            {!base.disabled && (
              <button type="button" aria-label={`Quitar ${v}`} className="text-brand-500 hover:text-brand-900" onClick={() => onChange(values.filter((x) => x !== v))}>
                ×
              </button>
            )}
          </span>
        ))}
        <input
          id={id}
          list={suggestions.length ? `${id}-list` : undefined}
          className="min-w-[10rem] flex-1 border-0 bg-transparent p-0 text-sm outline-none focus:ring-0"
          value={draft}
          placeholder={values.length ? "" : placeholder}
          disabled={base.disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => draft && add(draft)}
        />
      </div>
      {suggestions.length > 0 && (
        <datalist id={`${id}-list`}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </Field>
  );
}

export function FormMessage({ result }: { result: { ok: boolean; text: string } | null }) {
  if (!result) return null;
  return (
    <div
      role="status"
      className={`rounded-lg border px-4 py-2.5 text-sm ${
        result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      {result.text}
    </div>
  );
}

// Lista legible de errores de campos, útil cuando el error está en otro paso del wizard.
export function ErrorSummary({ errors, labels }: { errors: Record<string, string>; labels: Record<string, string> }) {
  const entries = Object.entries(errors);
  if (!entries.length) return null;
  return (
    <ul className="mt-2 list-inside list-disc text-xs text-red-700">
      {entries.slice(0, 12).map(([k, msg]) => (
        <li key={k}>
          <strong>{labels[k] ?? labels[k.split(".")[0]] ?? k}:</strong> {msg}
        </li>
      ))}
      {entries.length > 12 && <li>… y {entries.length - 12} más</li>}
    </ul>
  );
}
