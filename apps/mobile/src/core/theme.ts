import { colors as sharedColors } from "@dike/design-tokens";

export const theme = {
  colors: sharedColors,
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: { sm: 8, md: 14, lg: 20, xl: 26, pill: 999 },
  shadow: {
    card: {
      shadowColor: "#083c2e",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.07,
      shadowRadius: 18,
      elevation: 3,
    },
  },
} as const;
