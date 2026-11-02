/** Keep the place name separate from its street and administrative address. */
export function splitPlaceLabel(label: string) {
  const [name = "", ...parts] = label
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return { name, address: parts.join(", ") };
}
