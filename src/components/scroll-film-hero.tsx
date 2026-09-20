import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { IconArrowRight } from "@/components/icons";
import "./scroll-film-hero.css";

import { scrollFilm } from "@/data/scroll-film";
type Connection = EventTarget & { saveData?: boolean; effectiveType?: string };
type DeviceNavigator = Navigator & { connection?: Connection; deviceMemory?: number };

/** A fixed camera path from the supplied film, driven by native page scrolling. */
export function ScrollFilmHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [motion, setMotion] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    const video = videoRef.current;
    const poster = imageRef.current;
    const copy = copyRef.current;
    if (!section || !stage || !video || !poster || !copy) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia(scrollFilm.mobileQuery);
    const device = navigator as DeviceNavigator;
    const connection = device.connection;
    let disposed = false;
    let enabled = false;
    let frame = 0;
    let revealFrame = 0;
    let videoFrame = 0;
    let target = 0;
    let position = 0;
    let distance = 1;
    let top = 0;
    let inView = false;
    const directBooking = window.location.hash === "#buchung";
    let started = false;
    let firstFrame = false;

    const allowed = () =>
      !directBooking &&
      !reduce.matches &&
      !connection?.saveData &&
      !["slow-2g", "2g", "3g"].includes(connection?.effectiveType ?? "") &&
      !(device.deviceMemory && device.deviceMemory <= 2) &&
      !(device.hardwareConcurrency && device.hardwareConcurrency <= 2);

    const reveal = () => {
      if (disposed || !enabled || video.readyState < 2) return;
      firstFrame = true;
      video.dataset.visible = "true";
    };
    const endTime = () =>
      Math.max(0, (Number.isFinite(video.duration) ? video.duration : 8) - 1 / 24);
    const seek = () => {
      if (!enabled || pausedRef.current || !started || video.seeking || video.readyState < 2)
        return;
      const next = position * endTime();
      if (Math.abs(video.currentTime - next) >= 1 / 48) video.currentTime = next;
    };
    const paint = () => {
      frame = 0;
      if (!enabled || !inView || document.hidden) return;
      target = Math.min(1, Math.max(0, (window.scrollY - top) / distance));
      const difference = target - position;
      position = Math.abs(difference) < 0.0008 ? target : position + difference * 0.24;
      const opacity = Math.max(0, 1 - position / 0.22);
      copy.style.opacity = String(opacity);
      copy.style.transform = `translateY(${-position * 55}px)`;
      // Invisible links must not remain keyboard focus targets.
      copy.inert = opacity < 0.03;
      section.style.setProperty("--film-progress", String(position));
      seek();
      if (position !== target) frame = window.requestAnimationFrame(paint);
    };
    const schedule = () => {
      if (!frame && enabled) frame = window.requestAnimationFrame(paint);
    };
    const measure = () => {
      top = section.getBoundingClientRect().top + window.scrollY;
      distance = Math.max(1, section.offsetHeight - stage.offsetHeight);
      schedule();
    };
    const seeked = () => {
      if (!firstFrame) {
        revealFrame = window.requestAnimationFrame(reveal);
      }
      seek(); // Coalesce rapid scroll changes; never queue concurrent seeks.
    };
    const loaded = () => {
      if (!enabled) return;
      if (!firstFrame && video.requestVideoFrameCallback && !videoFrame) {
        videoFrame = video.requestVideoFrameCallback(() => {
          videoFrame = 0;
          reveal();
        });
      }
      // Present a decoded frame without autoplay, also on touch devices.
      video.currentTime = Math.max(0.001, position * endTime());
      schedule();
    };
    const start = () => {
      if (disposed || !enabled || started || !inView || document.hidden || !poster.complete) return;
      started = true;
      video.poster = poster.currentSrc || poster.src;
      video.src = mobile.matches ? scrollFilm.mobileVideo : scrollFilm.desktopVideo;
      video.load();
    };
    const resizeMedia = () => {
      if (!started) return;
      started = false;
      firstFrame = false;
      if (videoFrame) video.cancelVideoFrameCallback(videoFrame);
      videoFrame = 0;
      delete video.dataset.visible;
      start();
    };
    const configure = () => {
      enabled = allowed();
      section.dataset.motion = enabled ? "scroll" : "still";
      setMotion(enabled);
      if (enabled) {
        measure();
        start();
      } else {
        window.cancelAnimationFrame(frame);
        if (videoFrame) video.cancelVideoFrameCallback(videoFrame);
        videoFrame = 0;
        frame = 0;
        video.pause();
        video.removeAttribute("src");
        video.load();
        delete video.dataset.visible;
        started = false;
        firstFrame = false;
        copy.style.opacity = "1";
        copy.style.transform = "none";
        copy.inert = false;
      }
    };
    const failed = () => {
      enabled = false;
      setMotion(false);
      // Keep the current document height if the visitor has entered the film.
      section.dataset.motion = window.scrollY > top + 80 ? "fallback" : "still";
      delete video.dataset.visible;
      copy.style.opacity = "1";
      copy.style.transform = "none";
      copy.inert = false;
    };
    const visibility = () => {
      if (!document.hidden) {
        start();
        schedule();
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) {
        start();
        measure();
      }
    });
    observer.observe(section);
    const resize = new ResizeObserver(measure);
    resize.observe(section);
    resize.observe(stage);
    poster.addEventListener("load", start);
    video.addEventListener("loadeddata", loaded);
    video.addEventListener("seeked", seeked);
    video.addEventListener("error", failed);
    section.addEventListener("film-resume", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    window.addEventListener("pageshow", measure);
    document.addEventListener("visibilitychange", visibility);
    mobile.addEventListener("change", resizeMedia);
    reduce.addEventListener("change", configure);
    connection?.addEventListener("change", configure);
    configure();

    return () => {
      disposed = true;
      observer.disconnect();
      resize.disconnect();
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(revealFrame);
      if (videoFrame) video.cancelVideoFrameCallback(videoFrame);
      poster.removeEventListener("load", start);
      video.removeEventListener("loadeddata", loaded);
      video.removeEventListener("seeked", seeked);
      video.removeEventListener("error", failed);
      section.removeEventListener("film-resume", schedule);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      window.removeEventListener("pageshow", measure);
      document.removeEventListener("visibilitychange", visibility);
      mobile.removeEventListener("change", resizeMedia);
      reduce.removeEventListener("change", configure);
      connection?.removeEventListener("change", configure);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, []);

  return (
    <section ref={sectionRef} className="scroll-film" aria-label="White Gloss – bis ins Detail">
      <div ref={stageRef} className="scroll-film-stage">
        <div className="scroll-film-media">
          <picture>
            <source
              media={scrollFilm.mobileQuery}
              srcSet={scrollFilm.mobilePosters}
              sizes="100vw"
            />
            <img
              ref={imageRef}
              src={scrollFilm.desktopPoster}
              srcSet={scrollFilm.desktopPosters}
              sizes="100vw"
              width={1920}
              height={1080}
              alt="Schwarzer Klassiker mit glänzendem Lack und Chromdetails im dunklen Studio"
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </picture>
          <video
            ref={videoRef}
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            tabIndex={-1}
            disablePictureInPicture
          />
        </div>
        <div className="scroll-film-shade" aria-hidden="true" />
        <div ref={copyRef} className="scroll-film-copy">
          <div className="scroll-film-brand">
            <p className="scroll-film-brand-name">White Gloss Detailing</p>
            <p className="scroll-film-tagline">No compromises. Only results.</p>
          </div>
          <h1>
            Ihr Fahrzeug.
            <br />
            Unser Handwerk.
            <br />
            <span>Bis ins Detail.</span>
          </h1>
          <Link to="/" hash="buchung" className="scroll-film-cta">
            Termin anfragen <IconArrowRight className="size-4" aria-hidden />
          </Link>
          <Link to="/preise" className="scroll-film-prices">
            Pakete & Preise
          </Link>
        </div>
        <div className="scroll-film-bottom">
          <a href="#nach-dem-film" className="scroll-film-skip">
            <span>{motion ? "Scrollen & entdecken" : "Mehr entdecken"}</span>
            <span aria-hidden="true">↓</span>
          </a>
          <div className="scroll-film-track" aria-hidden="true">
            <span />
          </div>
          {motion && (
            <button
              type="button"
              className="scroll-film-pause"
              aria-pressed={paused}
              onClick={() => {
                pausedRef.current = !pausedRef.current;
                setPaused(pausedRef.current);
                sectionRef.current?.dispatchEvent(new Event("film-resume"));
              }}
            >
              {paused ? "Bewegung fortsetzen" : "Bewegung pausieren"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
