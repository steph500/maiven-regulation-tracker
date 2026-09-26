"use client";
import * as Popover from "@radix-ui/react-popover";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import { formatDate } from "@/lib/format-date";

export function DateRange({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const summary =
    from || to
      ? `${from ? formatDate(from) : "Any start"} – ${to ? formatDate(to) : "Any end"}`
      : "All publication dates";
  return (
    <Popover.Root>
      <Popover.Trigger
        className="control date-trigger"
        aria-label={`Date range: ${summary}`}
      >
        <CalendarDays size={19} aria-hidden="true" />
        <span>{summary}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="date-popover"
          sideOffset={10}
          align="start"
          aria-label="Publication date range"
        >
          <div className="popover-heading">
            <strong>Publication date</strong>
            <Popover.Close
              className="icon-button"
              aria-label="Close date range"
            >
              <X size={18} />
            </Popover.Close>
          </div>
          <p>Include rules published on or between these dates.</p>
          <label>
            From
            <input
              aria-label="Published from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => onChange(e.target.value, to)}
            />
          </label>
          <label>
            To
            <input
              aria-label="Published to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => onChange(from, e.target.value)}
            />
          </label>
          <div className="popover-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => onChange("", "")}
            >
              Clear dates
            </button>
            <Popover.Close className="primary small">Done</Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
