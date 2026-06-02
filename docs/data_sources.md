# Data Sources

All spatial datasets are fetched from public WFS endpoints hosted on the Geoportal Berlin.

---

## Tree inventories

| Dataset | Provider | URL | License |
|---|---|---|---|
| Baumbestand Berlin (Straßenbäume + Anlagenbäume) | Senatsverwaltung für Mobilität, Verkehr, Klimaschutz und Umwelt | [govdata.de](https://www.govdata.de/suche/daten/baumbestand-berlin) | [dl-de/zero-2-0](https://www.govdata.de/dl-de/zero-2-0) |
| Grün Berlin GmbH Anlagenbäume | Grün Berlin GmbH | [govdata.de](https://www.govdata.de/suche/daten/baumbestand-in-den-liegenschaften-der-grun-berlin-gmbh-anlagenbaume) | [dl-de/by-2-0](https://www.govdata.de/dl-de/by-2-0) |

WFS endpoint for Straßenbäume + Anlagenbäume: `https://gdi.berlin.de/services/wfs/baumbestand`  
WFS endpoint for Grün Berlin: `https://gdi.berlin.de/services/wfs/baumbestand_gruen_berlin`

---

## Forest polygons

| Dataset | Provider | URL | License |
|---|---|---|---|
| Alters- und Bestandesstruktur der Wälder — Forstbetriebskarte 2014 (Hauptbaumarten) | Senatsverwaltung für Mobilität, Verkehr, Klimaschutz und Umwelt | [govdata.de](https://www.govdata.de/suche/daten/alters-und-bestandesstruktur-der-walder-forstbetriebskarte-2014-umweltatlas) | [dl-de/zero-2-0](https://www.govdata.de/dl-de/zero-2-0) |

WFS endpoint: `https://gdi.berlin.de/services/wfs/ua_forstbetriebskarte_2014`  

---

## Administrative boundaries

| Dataset | Provider | URL | License |
|---|---|---|---|
| ALKIS Berlin — Ortsteile (used for Ortsteile + Bezirke) | Senatsverwaltung für Stadtentwicklung, Bauen und Wohnen | [govdata.de](https://www.govdata.de/suche/daten/alkis-berlin) | [dl-de/zero-2-0](https://www.govdata.de/dl-de/zero-2-0) |

WFS endpoint: `https://gdi.berlin.de/services/wfs/alkis_ortsteile`  

---

## Tree silhouettes

Silhouettes of prevailing genera at each resolution level are fetched from [PhyloPic](https://www.phylopic.org) and stored in `web/public/icons/`. Some images are simplified and optimized. 

| Genus | Contributor | License |
|---|---|---|
| [*Abies*](https://www.phylopic.org/images/5d027e89-ce3c-465e-afa0-761c1c360300/) | Ferran Sayol | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [*Acer*](https://www.phylopic.org/images/25e1de47-8f26-4ae0-beda-44bbdc079934/) | T. Michael Keesey | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| [*Aesculus*](https://www.phylopic.org/images/03c65a5b-1ec7-4628-9b15-881d78102d6e/) | Pablo Castro Sánchez-Bermejo | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [*Alnus*](https://www.phylopic.org/images/729a1e25-7e3e-475e-ba12-7095625ff245/) | Carlos Galaz-Samaniego | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [*Betula*](https://www.phylopic.org/images/226ba0e2-ec8f-4046-bedb-9723b843593c/) | Pablo Castro Sánchez-Bermejo | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [*Cornus*](https://www.phylopic.org/images/8b16a223-4e27-4ce5-83a4-904b86287d49/) | Gabriela Palomo-Munoz | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| [*Fagus*](https://www.phylopic.org/images/f95829c3-69b7-4781-bb10-b303722527f8/) | Ferran Sayol | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [*Fraxinus*](https://www.phylopic.org/images/4cc65fda-dd59-4035-af92-d6f09bbc7496/) | Pablo Castro Sánchez-Bermejo | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [*Ginkgo*](https://www.phylopic.org/images/098b93a4-b9aa-4a80-9698-4528466fdb61/) | T. Michael Keesey | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| [*Juniperus*](https://www.phylopic.org/images/fbe23759-930e-43c6-a138-9d052d0a8bda/) | Andy Wilson | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [*Liquidambar*](https://www.phylopic.org/images/4ede089f-524d-4f88-8f86-0784b3386ba2/) | Andy Wilson | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [*Magnolia*](https://www.phylopic.org/images/b1574f09-14fa-4042-8f37-7d31c2f08743/) | Luna Luisa Sánchez Reyes | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [*Malus*](https://www.phylopic.org/images/7d0974be-1e74-45a0-b249-52bb6360e666/) | T. Michael Keesey | [Public Domain Mark 1.0](https://creativecommons.org/publicdomain/mark/1.0/) |
| [*Morus*](https://www.phylopic.org/images/89659603-08bb-4cef-9c0d-8ac84ae76b00/) | Raju Mondal | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| [*Picea*](https://www.phylopic.org/images/81b9e25d-7857-4f33-8197-e46305041fd6/) | Guillaume Dera | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [*Pinus*](https://www.phylopic.org/images/354889ab-a702-4bd0-b881-8e6faa5925d9/) | Juri Felix | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [*Platanus*](https://www.phylopic.org/images/806a6ae9-28a0-4dc6-beeb-f6129a44f10e/) | Michele M Tobias | [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/) |
| [*Populus*](https://www.phylopic.org/images/a6ea366c-a098-4a25-90df-7ce321750a87/) | Mason McNair | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [*Prunus*](https://www.phylopic.org/images/44c956aa-5dde-42f9-92d5-52380d1a0312/) | T. Michael Keesey | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| [*Pseudotsuga*](https://www.phylopic.org/images/38c636a7-f4b3-4a6c-89b1-fb2dcbdafa06/) | Michele M Tobias | [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/) |
| [*Quercus*](https://www.phylopic.org/images/5ff28c29-b0f3-4e96-bd1c-1272fa410e46/) | Pablo Castro Sánchez-Bermejo | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [*Robinia*](https://www.phylopic.org/images/6ec5cb77-9b4f-46cf-a184-fed1e4f29934/) | Mattia Menchetti | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [*Sorbus*](https://www.phylopic.org/images/7086d4fe-c37c-4901-b426-752851f4685c/) | Pablo Castro Sánchez-Bermejo | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [*Tetradium*](https://www.phylopic.org/images/53b543aa-2a5e-4407-88cd-6acbb0b5c3f9/) | Kelsey Wood | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [*Thuja*](https://www.phylopic.org/images/9f1a713d-ff7d-4099-9abf-80cea860f431/) | Guillaume Dera | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [*Tilia*](https://www.phylopic.org/images/cb24ad09-73a0-459e-9424-52afe359343c/) | Pablo Castro Sánchez-Bermejo | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |

