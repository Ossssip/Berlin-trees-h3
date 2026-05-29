export function loadPhylopicIndex() {
  return fetch('public/icons/phylopic_index.json')
    .then((response) => (response.ok ? response.json() : {}))
    .catch(() => ({}));
}

// forest_genus_1 is already the lowercase Latin genus — use it directly as the image name
export function buildForestIconImageExpr() {
  return ['get', 'forest_genus_1'];
}

export function registerMissingImagePlaceholder(map) {
  map.on('styleimagemissing', (event) => {
    if (!map.hasImage(event.id)) {
      map.addImage(event.id, { width: 1, height: 1, data: new Uint8ClampedArray(4) }, { sdf: true });
    }
  });
}

const _loadingGenera = new Set();
const _svgDataUris = {};

export function getGenusDataUri(genus) {
  return _svgDataUris[genus?.toLowerCase()] ?? null;
}

export async function loadPhylopicIcons(map, index) {
  const size = 64;
  const genera = Object.entries(index)
    .filter(([, entry]) => entry !== null)
    .map(([genus]) => genus)
    .filter((genus) => !_loadingGenera.has(genus));

  genera.forEach((genus) => _loadingGenera.add(genus));

  const results = await Promise.all(genera.map((genus) =>
    fetch(`public/icons/${genus}.svg`)
      .then((response) => response.text())
      .then((svgText) => new Promise((resolve) => {
        const vbMatch = svgText.match(/viewBox=["']\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
        let patched = svgText;
        if (vbMatch) {
          const viewBoxWidth = parseFloat(vbMatch[3]);
          const viewBoxHeight = parseFloat(vbMatch[4]);
          if (viewBoxWidth > 0 && viewBoxHeight > 0) {
            patched = svgText.replace(/<svg([^>]*)>/, (match, attrs) => {
              const normalizedAttrs = attrs
                .replace(/\s+width=["'][^"']*["']/g, '')
                .replace(/\s+height=["'][^"']*["']/g, '');
              return `<svg${normalizedAttrs} width="${viewBoxWidth}" height="${viewBoxHeight}">`;
            });
          }
        }

        _svgDataUris[genus] = `data:image/svg+xml,${encodeURIComponent(patched)}`;

        const blob = new Blob([patched], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const image = new Image();

        image.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0, size, size);
          URL.revokeObjectURL(url);
          const raw = context.getImageData(0, 0, size, size).data;
          const data = new Uint8Array(size * size * 4);
          for (let i = 0; i < raw.length; i += 4) {
            if (raw[i + 3] > 10) {
              data[i] = 255;
              data[i + 1] = 255;
              data[i + 2] = 255;
              data[i + 3] = 255;
            }
          }
          resolve({ genus, data });
        };

        image.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(null);
        };

        image.src = url;
      }))
      .catch(() => null)
  ));

  for (const result of results) {
    if (!result) continue;
    if (map.hasImage(result.genus)) {
      map.removeImage(result.genus);
    }
    map.addImage(
      result.genus,
      { width: size, height: size, data: new Uint8ClampedArray(result.data) },
      { sdf: true },
    );
  }

  map.triggerRepaint();
}
