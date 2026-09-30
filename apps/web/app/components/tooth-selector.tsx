"use client";
import { useEffect, useRef, useState } from "react";
import { RotateCcw, ZoomIn, ZoomOut, Box } from "lucide-react";
import { quadrants, toothName, type Dentition } from "./dentition";
import type { createToothScene } from "./tooth-scene";

export default function ToothSelector({
  selected,
  assigned,
  onSelect,
  procedure,
  readOnly = false,
}: {
  selected: string;
  assigned: string[];
  onSelect: (code: string) => void;
  procedure: number;
  readOnly?: boolean;
}) {
  const [mode, setMode] = useState<Dentition>(
    /^[5-8]/.test(selected) ? "child" : "adult",
  );
  const otherDentition =
    selected !== "ALL" &&
    /^([1-4][1-8]|[5-8][1-5])$/.test(selected) &&
    (/^[5-8]/.test(selected) ? "child" : "adult") !== mode;
  const [status, setStatus] = useState("loading");
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<ReturnType<typeof createToothScene> | null>(null);
  const latest = useRef({ selected, assigned, onSelect });
  useEffect(() => {
    latest.current = { selected, assigned, onSelect };
    scene.current?.select(selected, assigned);
  }, [selected, assigned, onSelect]);
  useEffect(() => {
    if (selected !== "ALL" && /^[1-8]/.test(selected))
      setMode(Number(selected[0]) > 4 ? "child" : "adult");
  }, [selected]);
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    void import("./tooth-scene")
      .then(({ createToothScene }) => {
        if (cancelled || !host.current) return;
        try {
          scene.current = createToothScene(
            host.current,
            mode,
            (code) => latest.current.onSelect(code),
            () => setStatus("unavailable"),
          );
          scene.current.select(
            latest.current.selected,
            latest.current.assigned,
          );
          setStatus("ready");
        } catch {
          setStatus("unavailable");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("unavailable");
      });
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [mode]);
  return (
    <section
      className="tooth-selector"
      aria-label={readOnly ? "Proposed treatment teeth" : "Tooth selection"}
    >
      <div className="tooth-selector-heading">
        <div>
          <h3>
            <Box size={18} />
            {readOnly ? "3D proposed treatment teeth" : "3D tooth selection"}
          </h3>
          <p>
            {readOnly
              ? "Inspect the teeth included in this proposal. The published plan remains unchanged."
              : `Choose a tooth for Procedure ${procedure}.`}{" "}
            FDI numbering, from the patient’s perspective.
          </p>
        </div>
        <div className="dentition-switch" aria-label="Dentition">
          <button
            type="button"
            aria-pressed={mode === "child"}
            onClick={() => setMode("child")}
          >
            Child · 20 teeth
          </button>
          <button
            type="button"
            aria-pressed={mode === "adult"}
            onClick={() => setMode("adult")}
          >
            Adult · 32 teeth
          </button>
        </div>
      </div>
      <div className="tooth-map-layout">
        <div className="tooth-stage">
          <div ref={host} className="tooth-canvas" data-render-state={status} />
          {status !== "ready" && (
            <div className="tooth-scene-message" role="status">
              {status === "loading"
                ? "Loading 3D teeth…"
                : "3D view unavailable. Choose a numbered tooth below."}
            </div>
          )}
          <div className="tooth-camera-tools">
            <button
              type="button"
              className="icon-btn"
              aria-label="Zoom in on teeth"
              disabled={status !== "ready"}
              onClick={() => scene.current?.zoom(0.2)}
            >
              <ZoomIn size={17} />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Zoom out from teeth"
              disabled={status !== "ready"}
              onClick={() => scene.current?.zoom(-0.2)}
            >
              <ZoomOut size={17} />
            </button>
            <button
              type="button"
              className="text-link"
              disabled={status !== "ready"}
              onClick={() => scene.current?.reset()}
            >
              <RotateCcw size={14} />
              Reset view
            </button>
          </div>
          <p className="tooth-map-hint">
            {readOnly ? "Click to inspect" : "Click to select"} · Drag to rotate
            · Schematic dentition
          </p>
        </div>
        <div className="tooth-number-panel">
          <div className="tooth-selection-summary" role="status">
            <strong>
              {selected === "ALL" ? "Whole mouth" : `Tooth ${selected || "—"}`}
            </strong>
            <span>{toothName(selected)}</span>
            <small>
              {readOnly
                ? assigned.includes(selected) || assigned.includes("ALL")
                  ? "Included in this proposal"
                  : "Not included in this proposal"
                : `Assigned to Procedure ${procedure}`}
            </small>
          </div>
          {otherDentition && !readOnly && (
            <p className="dentition-mismatch">
              This tooth belongs to the {mode === "child" ? "adult" : "child"}{" "}
              view. Choose a tooth here to change Procedure {procedure}.
            </p>
          )}
          <div className="tooth-legend">
            <span>
              <i className="selected" />
              Selected
            </span>
            <span>
              <i className="assigned" />
              In this proposal
            </span>
          </div>
          {quadrants(mode).map((q) => (
            <fieldset key={q.quadrant} className="tooth-quadrant">
              <legend>{q.label}</legend>
              <div>
                {(q.right ? [...q.teeth].reverse() : q.teeth).map((code) => (
                  <button
                    type="button"
                    key={code}
                    aria-label={`Tooth ${code}: ${toothName(code)}`}
                    aria-pressed={selected === code}
                    className={
                      assigned.includes(code) || assigned.includes("ALL")
                        ? "assigned"
                        : ""
                    }
                    onClick={() => onSelect(code)}
                    title={toothName(code)}
                  >
                    {code}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          {(!readOnly || assigned.includes("ALL")) && (
            <button
              type="button"
              className="whole-mouth"
              aria-pressed={selected === "ALL"}
              onClick={() => onSelect("ALL")}
            >
              Whole mouth · ALL
            </button>
          )}
          <p className="muted">
            {readOnly
              ? "Switch between child/adult views to inspect all proposed teeth, including mixed dentition."
              : "Switching child/adult views keeps all procedures, including mixed dentition."}
          </p>
        </div>
      </div>
    </section>
  );
}
