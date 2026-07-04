'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SelectOption = { value: string; label: string };

const MAX_RESULTS = 50;

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function filterOptions(options: SelectOption[], query: string): SelectOption[] {
  const q = normalizeQuery(query);
  if (!q) return [];
  return options.filter((option) => option.label.toLowerCase().includes(q)).slice(0, MAX_RESULTS);
}

export function SearchableSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Escribí para buscar…',
  disabled,
  hint,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => filterOptions(options, query), [options, query]);
  const showDropdown = open && normalizeQuery(query).length >= 1;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selectOption(option: SelectOption) {
    onChange(option.value);
    setQuery('');
    setOpen(false);
  }

  function clearSelection() {
    onChange('');
    setQuery('');
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>

      {selected ? (
        <div className="mb-2 flex items-start justify-between gap-2 rounded-lg border border-[#1a5fb4]/20 bg-[#eef5ff] px-3 py-2 text-sm text-[#1a5fb4]">
          <span>{selected.label}</span>
          {!disabled ? (
            <button
              type="button"
              onClick={clearSelection}
              className="shrink-0 rounded p-0.5 hover:bg-[#1a5fb4]/10"
              aria-label="Quitar selección"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="relative">
        <input
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={selected ? 'Buscar otro…' : placeholder}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1a5fb4] disabled:bg-slate-50"
        />

        {showDropdown ? (
          <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {filtered.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  onClick={() => selectOption(option)}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm hover:bg-slate-50',
                    option.value === value && 'bg-[#eef5ff] font-medium text-[#1a5fb4]'
                  )}
                >
                  {option.label}
                </button>
              </li>
            ))}
            {!filtered.length ? (
              <li className="px-3 py-3 text-sm text-slate-400">Sin resultados</li>
            ) : null}
          </ul>
        ) : null}
      </div>

      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
      {!disabled && !hint ? (
        <span className="mt-1 block text-xs text-slate-500">
          {options.length} opciones precargadas. Escribí para filtrar.
        </span>
      ) : null}
    </div>
  );
}

export function SearchableMultiSelect({
  label,
  values,
  options,
  onChange,
  placeholder = 'Escribí para buscar…',
  hint,
}: {
  label: string;
  values: string[];
  options: SelectOption[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = normalizeQuery(query);
    if (!q) return [];
    return options
      .filter((option) => option.label.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [options, query]);

  const showDropdown = open && normalizeQuery(query).length >= 1;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function addValue(value: string) {
    if (!values.includes(value)) {
      onChange([...values, value]);
    }
    setQuery('');
    setOpen(false);
  }

  function removeValue(value: string) {
    onChange(values.filter((item) => item !== value));
  }

  const selectedOptions = values
    .map((value) => options.find((option) => option.value === value))
    .filter(Boolean) as SelectOption[];

  return (
    <div ref={containerRef} className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>

      {selectedOptions.length ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedOptions.map((option) => (
            <span
              key={option.value}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#eef5ff] py-0.5 pl-2.5 pr-1 text-xs font-medium text-[#1a5fb4]"
            >
              <span className="truncate">{option.label}</span>
              <button
                type="button"
                onClick={() => removeValue(option.value)}
                className="shrink-0 rounded-full p-0.5 hover:bg-[#1a5fb4]/10"
                aria-label={`Quitar ${option.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="mb-2 text-xs text-slate-400">Ninguno seleccionado</p>
      )}

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1a5fb4]"
        />

        {showDropdown ? (
          <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {filtered.map((option) => {
              const isSelected = values.includes(option.value);
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    disabled={isSelected}
                    onClick={() => addValue(option.value)}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:cursor-default disabled:opacity-50',
                      isSelected && 'bg-slate-50 text-slate-400'
                    )}
                  >
                    {option.label}
                    {isSelected ? ' (ya seleccionado)' : ''}
                  </button>
                </li>
              );
            })}
            {!filtered.length ? (
              <li className="px-3 py-3 text-sm text-slate-400">Sin resultados</li>
            ) : null}
          </ul>
        ) : null}
      </div>

      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
      {!hint ? (
        <span className="mt-1 block text-xs text-slate-500">
          {options.length} opciones precargadas. Escribí para filtrar y agregar.
        </span>
      ) : null}
    </div>
  );
}
