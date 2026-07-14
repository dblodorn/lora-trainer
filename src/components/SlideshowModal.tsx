import { useState, useEffect, useCallback } from "react";
import { View, Text, Button, Modal } from "reshaped";
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

  // Sync index when modal opens
  useEffect(() => {
    if (active) setCurrentIndex(startIndex);
  }, [active, startIndex]);

  const goBack = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const goForward = useCallback(() => {
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

  return (
    <Modal
      active={active}
      onClose={onClose}
      position="full-screen"
      padding={0}
      blurredOverlay
    >
      <View
        direction="column"
        align="center"
        justify="center"
        attributes={{
          style: {
            height: "100vh",
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            backdropFilter: "blur(8px)",
            position: "relative",
          },
        }}
      >
        {/* Image with framer-motion slide transition */}
        <View
          height="100%"
          align="center"
          justify="center"
          padding={4}
          attributes={{ style: { flex: 1, minHeight: 0 } }}
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={current.id}
              src={current.imageUrl}
              alt={current.prompt}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                borderRadius: "8px",
              }}
            />
          </AnimatePresence>
        </View>

        {/* Caption + counter */}
        <View
          direction="column"
          align="center"
          gap={1}
          padding={4}
          attributes={{
            style: {
              position: "absolute",
              bottom: 0,
              width: "100%",
              textAlign: "center",
            },
          }}
        >
          <Text variant="body-2" color="neutral" attributes={{ style: { maxWidth: "600px" } }}>
            {current.prompt}
          </Text>
          <View direction="row" align="center" justify="center" gap={2}>
            <Text variant="caption-1" color="neutral-faded">
              {currentIndex + 1} / {images.length}
            </Text>
            {current.loraScaleName && (
              <Text variant="caption-1" color="neutral-faded">
                · {current.loraScaleName}
              </Text>
            )}
          </View>
        </View>

        {/* Back button — left side */}
        <div
          style={{
            position: "absolute",
            left: "16px",
            top: "50%",
            transform: "translateY(-50%)",
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
      </View>
    </Modal>
  );
}
