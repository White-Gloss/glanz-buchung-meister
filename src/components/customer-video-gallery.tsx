import { useEffect, useId, useRef, useState } from "react";

export type CustomerVideo = {
  title: string;
  category: string;
  duration: string;
  description: string;
  src: string;
  poster: string;
  featured?: boolean;
};

export function CustomerVideoGallery({ videos, compact = false }: { videos: readonly CustomerVideo[]; compact?: boolean }) {
  const [active, setActive] = useState<CustomerVideo | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (active && !dialog.open) dialog.showModal();
    if (!active && dialog.open) {
      dialog.close();
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = priorOverflow;
    };
  }, [active]);

  return (
    <>
      <ul className={compact ? "wg-video-grid wg-video-grid--compact" : "wg-video-grid"}>
        {videos.map((video) => (
          <li key={video.src} className={video.featured && !compact ? "wg-video-card wg-video-card--featured" : "wg-video-card"}>
            <button type="button" className="wg-video-trigger" onClick={(event) => { triggerRef.current = event.currentTarget; setActive(video); }} aria-label={`${video.title} ansehen, ${video.duration}`}>
              <img src={video.poster} alt="" className="wg-video-poster" loading="lazy" />
              <span className="wg-video-play" aria-hidden><span /></span>
              <span className="wg-video-meta"><span>{video.category}</span><span>{video.duration}</span></span>
            </button>
            <div className="wg-video-copy">
              <h3 className="heading-3">{video.title}</h3>
              {!compact ? <p>{video.description}</p> : null}
            </div>
          </li>
        ))}
      </ul>
      <dialog
        ref={dialogRef}
        className="wg-video-dialog"
        aria-labelledby={titleId}
        onCancel={(event) => { event.preventDefault(); setActive(null); }}
        onClose={() => setActive(null)}
        onClick={(event) => { if (event.target === event.currentTarget) setActive(null); }}
      >
        {active ? (
          <div className="wg-video-modal">
            <div className="wg-video-modal-top">
              <div><p className="kicker">{active.category} · {active.duration}</p><h2 id={titleId} className="heading-3 mt-1">{active.title}</h2></div>
              <button type="button" className="wg-video-close" onClick={() => setActive(null)} aria-label="Video schließen">Schließen</button>
            </div>
            <video className="wg-video-player" controls autoPlay playsInline preload="metadata" poster={active.poster}>
              <source src={`${active.src}.webm`} type="video/webm" />
              <source src={`${active.src}.mp4`} type="video/mp4" />
              Ihr Browser unterstützt die Videowiedergabe nicht.
            </video>
            <p className="wg-video-description">{active.description}</p>
          </div>
        ) : null}
      </dialog>
    </>
  );
}