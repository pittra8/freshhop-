address: (() => {
  if (!el.tags) return null;
  if (el.tags["addr:full"]) return el.tags["addr:full"];
  if (el.tags["addr:street"]) {
    const parts = [
      el.tags["addr:housenumber"],
      el.tags["addr:street"],
      el.tags["addr:city"],
    ].filter(Boolean);
    return parts.join(" ");
  }
  return null;
})(),
