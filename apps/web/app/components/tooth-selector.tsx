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
      aria-label={readOnly ? "Tedavi önerilen dişler" : "Diş seçimi"}
    >
      <div className="tooth-selector-heading">
        <div>
          <h3>
            <Box size={18} />
            {readOnly ? "3B tedavi önerilen dişler" : "3B diş seçimi"}
          </h3>
          <p>
            {readOnly
              ? "Bu teklifteki dişleri inceleyin. Yayımlanan plan değişmez."
              : `${procedure}. işlem için bir diş seçin.`}{" "}
            Hastanın bakış açısından FDI numaralandırması.
          </p>
        </div>
        <div className="dentition-switch" aria-label="Diş yapısı">
          <button
            type="button"
            aria-pressed={mode === "child"}
            onClick={() => setMode("child")}
          >
            Çocuk · 20 diş
          </button>
          <button
            type="button"
            aria-pressed={mode === "adult"}
            onClick={() => setMode("adult")}
          >
            Yetişkin · 32 diş
          </button>
        </div>
      </div>
      <div className="tooth-map-layout">
        <div className="tooth-stage">
          <div ref={host} className="tooth-canvas" data-render-state={status} />
          {status !== "ready" && (
            <div className="tooth-scene-message" role="status">
              {status === "loading"
                ? "3B dişler yükleniyor…"
                : "3B görünüm kullanılamıyor. Aşağıdan numaralı bir diş seçin."}
            </div>
          )}
          <div className="tooth-camera-tools">
            <button
              type="button"
              className="icon-btn"
              aria-label="Dişleri yakınlaştır"
              disabled={status !== "ready"}
              onClick={() => scene.current?.zoom(0.2)}
            >
              <ZoomIn size={17} />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Dişleri uzaklaştır"
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
              Görünümü sıfırla
            </button>
          </div>
          <p className="tooth-map-hint">
            {readOnly ? "İncelemek için tıklayın" : "Seçmek için tıklayın"} ·
            Döndürmek için sürükleyin · Şematik diş yapısı
          </p>
        </div>
        <div className="tooth-number-panel">
          <div className="tooth-selection-summary" role="status">
            <strong>
              {selected === "ALL" ? "Tüm ağız" : `Diş ${selected || "—"}`}
            </strong>
            <span>{toothName(selected)}</span>
            <small>
              {readOnly
                ? assigned.includes(selected) || assigned.includes("ALL")
                  ? "Bu teklife dahil"
                  : "Bu teklife dahil değil"
                : `${procedure}. işleme atandı`}
            </small>
          </div>
          {otherDentition && !readOnly && (
            <p className="dentition-mismatch">
              Bu diş {mode === "child" ? "yetişkin" : "çocuk"} görünümüne ait.{" "}
              {procedure}. işlem için dişi ilgili görünümden seçin.
            </p>
          )}
          <div className="tooth-legend">
            <span>
              <i className="selected" />
              Seçili
            </span>
            <span>
              <i className="assigned" />
              Bu teklifte
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
                    aria-label={`Diş ${code}: ${toothName(code)}`}
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
              Tüm ağız · HEPSİ
            </button>
          )}
          <p className="muted">
            {readOnly
              ? "Karma diş yapısı dahil tüm önerilen dişleri incelemek için çocuk/yetişkin görünümleri arasında geçin."
              : "Çocuk/yetişkin görünümünü değiştirmek karma diş yapısı dahil tüm işlemleri korur."}
          </p>
        </div>
      </div>
    </section>
  );
}
