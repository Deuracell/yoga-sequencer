/** Draggable divider between the gallery and the preview pane. */
import { $ } from "./dom";
import { recall, remember } from "./files";

const MIN_PANE = 320, DEFAULT_PANE = 520;

function setPane(width: number): number {
  const clamped = Math.max(MIN_PANE, Math.min(width, window.innerWidth - 240 - 8));
  document.body.style.setProperty("--pane", `${clamped}px`);
  return clamped;
}

export function wireSplitter() {
  const split = $("split");
  const pane = () => split.nextElementSibling!.getBoundingClientRect().width;
  setPane(Number(recall("yoga.pane")) || DEFAULT_PANE);
  const save = (width: number) => remember("yoga.pane", String(width));

  split.onpointerdown = (e) => {
    e.preventDefault();
    split.setPointerCapture(e.pointerId);
    split.classList.add("active");
    document.body.classList.add("resizing");
    const move = (ev: PointerEvent) => setPane(window.innerWidth - ev.clientX - 4);
    const stop = (ev: PointerEvent) => {
      split.removeEventListener("pointermove", move);
      split.removeEventListener("pointerup", stop);
      split.classList.remove("active");
      document.body.classList.remove("resizing");
      save(setPane(window.innerWidth - ev.clientX - 4));
    };
    split.addEventListener("pointermove", move);
    split.addEventListener("pointerup", stop);
  };
  split.ondblclick = () => save(setPane(DEFAULT_PANE));
  split.onkeydown = (e) => {
    const step = ({ ArrowLeft: 20, ArrowRight: -20 } as Record<string, number>)[e.key];
    if (!step) return;
    e.preventDefault();
    save(setPane(pane() + step));
  };
  window.addEventListener("resize", () => setPane(pane()));
}
