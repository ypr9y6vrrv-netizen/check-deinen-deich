// Mitgliederliste: Suche & Sortierung.
const input = document.querySelector('[data-search-input]');
const grid = document.querySelector('[data-grid]');
const empty = document.querySelector('[data-empty]');
const sort = document.querySelector('[data-sort]');

function applyFilter() {
  if (!grid) return;
  const q = input.value.trim().toLowerCase();
  let visible = 0;
  for (const li of grid.children) {
    const show = !q || li.dataset.search.includes(q);
    li.hidden = !show;
    if (show) visible++;
  }
  empty.hidden = visible > 0;
}

input?.addEventListener('input', applyFilter);
sort?.addEventListener('change', () => {
  if (!grid) return;
  const items = [...grid.children];
  items.sort((a, b) => (sort.value === 'name'
    ? a.dataset.name.localeCompare(b.dataset.name, 'de')
    : Number(b.dataset.updated) - Number(a.dataset.updated)));
  grid.append(...items);
});

// Kaputte Avatare (alter Discord-Avatar) durch Initialen ersetzen
for (const img of document.querySelectorAll('.mcard-avatar img')) {
  const fallback = () => {
    const name = img.closest('.mcard')?.querySelector('.mcard-name')?.textContent.trim() ?? '?';
    const span = document.createElement('span');
    span.textContent = Array.from(name)[0]?.toUpperCase() ?? '?';
    img.replaceWith(span);
  };
  if (img.complete && img.naturalWidth === 0) fallback();
  else img.addEventListener('error', fallback, { once: true });
}
