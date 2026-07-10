import { generateThemeColors } from "reshaped/themes";

const config = {
  themes: {
    dmbk: {
      color: generateThemeColors({ primary: "#2563eb" }),
      fontFamily: {
        body: { family: "Arial, Helvetica, sans-serif" },
        title: { family: "Arial, Helvetica, sans-serif" },
      },
      radius: {
        small: { px: 0 },
        medium: { px: 0 },
        large: { px: 0 },
      },
    },
    "lora-trainer": {
      color: generateThemeColors({
        primary: { oklch: { l: 0, c: 0, h: 0 } },
        critical: { oklch: { l: 0.3, c: 0, h: 0 } },
        warning: { oklch: { l: 0.5, c: 0, h: 0 } },
        positive: { oklch: { l: 0.2, c: 0, h: 0 } },
        neutral: { oklch: { l: 0.92, c: 0, h: 0 } },
        brand: { oklch: { l: 0, c: 0, h: 0 } },
      }),
      fontFamily: {
        body: { family: "FFF Forward, Arial, Helvetica, sans-serif" },
        title: { family: "Graphik, FFF Forward, Arial, Helvetica, sans-serif" },
      },
      radius: {
        small: { px: 0 },
        medium: { px: 0 },
        large: { px: 0 },
      },
    },
  },
};

module.exports = config;
