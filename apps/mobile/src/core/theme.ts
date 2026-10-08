import { colors as sharedColors } from "@dike/design-tokens";

export const theme = {
  colors: sharedColors,
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: { sm: 8, md: 14, lg: 20 },
} as const;
