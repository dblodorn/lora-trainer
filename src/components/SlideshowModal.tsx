import { useState, useEffect, useCallback } from "react";
import { View, Text, Button, Modal, Badge } from "reshaped";
import { AnimatePresence, motion } from "framer-motion";

interface SlideshowImage {
  id: string;
  imageUrl: string;
  prompt: string;
  loraScaleName?: string | null;
}

interface SlideshowModalProps {
  active: boolean;
  onClose: () => void;
  images: SlideshowImage[];
  startIndex: number;
}

const ChevronLeftIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const ChevronRightIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const CloseIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

export default function SlideshowModal({
  active,
  onClose,
  images,
  startIndex,
}: SlideshowModalProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [direction, setDirection] = useState(1);

  // Sync index when modal opens
  useEffect(() => {
    if (active) {
      setCurrentIndex(startIndex);
      setDirection(1);
    }
  }, [active, startIndex]);

  const goBack = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const goForward = useCallback(() => {
    setDirection(1);
    setCurrentIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goBack();
      if (e.key === "ArrowRight") goForward();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, goBack, goForward, onClose]);

  if (!active || images.length === 0) return null;

  const current = images[currentIndex];
  const slideVariants = {
    enter: { opacity: 0 },
    center: { opacity: 1 },
    exit: { opacity: 0 },
  };

  return (
    <Modal
      active={active}
      onClose={onClose}
      position="full-screen"
      padding={0}
      blurredOverlay
    >
      <div
        style={{
          height: "100vh",
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(8px)",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {/* Image area — takes available space, leaves room for caption */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <AnimatePresence mode="wait" custom={direction}>
            <motion.img
              key={current.id}
              src={current.imageUrl}
              alt={current.prompt}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeOut" }}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                borderRadius: "8px",
              }}
            />
          </AnimatePresence>
        </div>

        {/* Caption + counter on one line */}
        <div
          style={{
            height: "48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "0 32px 16px 32px",
          }}
        >
          <Text variant="body-2" color="neutral" attributes={{ style: { maxWidth: "500px", textAlign: "center" } }}>
            {current.prompt}
          </Text>
          <Text variant="caption-1" color="neutral-faded">
            {currentIndex + 1} / {images.length}
          </Text>
        </div>

        {/* Back button — left side */}
        <div
          style={{
            position: "absolute",
            left: "16px",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 10,
          }}
        >
          <Button
            variant="ghost"
            color="neutral"
            onClick={goBack}
            attributes={{ "aria-label": "Previous image" }}
          >
            <ChevronLeftIcon />
          </Button>
        </div>

        {/* Forward button — right side */}
        <div
          style={{
            position: "absolute",
            right: "16px",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 10,
          }}
        >
          <Button
            variant="ghost"
            color="neutral"
            onClick={goForward}
            attributes={{ "aria-label": "Next image" }}
          >
            <ChevronRightIcon />
          </Button>
        </div>

        {/* Close button — top right */}
        <div
          style={{
            position: "absolute",
            right: "16px",
            top: "16px",
            zIndex: 10,
          }}
        >
          <Button
            variant="ghost"
            color="neutral"
            onClick={onClose}
            attributes={{ "aria-label": "Close slideshow" }}
          >
            <CloseIcon />
          </Button>
        </div>

        {/* LoRA weight badge — top left */}
        {current.loraScaleName && (
          <div
            style={{
              position: "absolute",
              left: "16px",
              top: "16px",
              zIndex: 10,
            }}
          >
            <Badge size="small" color="primary" variant="faded">
              {current.loraScaleName}
            </Badge>
          </div>
        )}
      </div>
    </Modal>
  );
}
