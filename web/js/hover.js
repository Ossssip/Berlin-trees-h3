function showHoverIcons(phylopicIndex, treeGenus, forestGenus) {

  const treesSlot = document.getElementById('hover-slot-trees');
  const forestSlot = document.getElementById('hover-slot-forest');
  const treesImage = document.getElementById('hover-icon-trees');
  const forestImage = document.getElementById('hover-icon-forest');
  const credit = document.getElementById('hover-credit');
  const credits = [];

  if (treeGenus && phylopicIndex[treeGenus.toLowerCase()]) {
    const genus = treeGenus.toLowerCase();
    treesImage.src = `public/icons/${genus}.svg`;
    treesImage.alt = treeGenus;
    treesSlot.classList.remove('hidden');
    const entry = phylopicIndex[genus];
    credits.push(`Trees (${treeGenus}): ${entry.credit}${entry.license ? ` · <a href="${entry.license}" target="_blank" rel="noopener">license</a>` : ''}`);
  } else {
    treesSlot.classList.add('hidden');
    treesImage.src = '';
  }

  if (forestGenus && phylopicIndex[forestGenus]) {
    forestImage.src = `public/icons/${forestGenus}.svg`;
    forestImage.alt = forestGenus;
    forestSlot.classList.remove('hidden');
    const entry = phylopicIndex[forestGenus];
    credits.push(`Forest (${forestGenus}): ${entry.credit}${entry.license ? ` · <a href="${entry.license}" target="_blank" rel="noopener">license</a>` : ''}`);
  } else {
    forestSlot.classList.add('hidden');
    forestImage.src = '';
  }

  credit.innerHTML = credits.length
    ? `${credits.join('<br>')} · <a href="https://www.phylopic.org" target="_blank" rel="noopener">PhyloPic</a>`
    : '';
}

export function setupHover(map, getPhylopicIndex) {
  const display = document.getElementById('popup-content');
  const hoverCard = document.getElementById('ctrl-hover');
  const hexLayers = [
    'admin_bezirke-fill',
    'admin_ortsteile-fill',
    'hexes_res6-fill',
    'hexes_res7-fill',
    'hexes_res8-fill',
    'hexes_res9-fill',
  ];

  [...hexLayers, 'trees-circle'].forEach((layerId) => {
    map.on('mousemove', layerId, (event) => {
      map.getCanvas().style.cursor = 'pointer';
      const props = event.features[0].properties;
      display.innerHTML = Object.entries(props)
        .filter(([, value]) => value !== null && value !== '' && value !== 0)
        .map(([key, value]) => `<b>${key}</b>: ${value}`)
        .join('<br>');

      const forestPct = props.forest_cover_pct || 0;
      const treeGenus = forestPct > 67 ? null : (props.dominant_genus || props.genus_latin || null);
      const forestGenus = forestPct >= 33 ? (props.forest_genus_1 || null) : null;
      showHoverIcons(getPhylopicIndex(), treeGenus, forestGenus);
      hoverCard.classList.add('visible');
    });

    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = '';
      hoverCard.classList.remove('visible');
      showHoverIcons({}, null, null);
    });
  });
}
