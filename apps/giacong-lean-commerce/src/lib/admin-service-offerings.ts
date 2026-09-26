export function parseOfferingLines(value: string): Array<{ href: string; label: string }> {
  return value.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf("|");
      if (separator < 0) return { href: "", label: line };
      return { href: line.slice(separator + 1).trim(), label: line.slice(0, separator).trim() };
    });
}
