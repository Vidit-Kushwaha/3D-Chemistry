var glviewer = null;

$(document).ready(function () {
  let inputQuery = document.getElementById("query");
  let inputStyle = document.getElementById("style");
  let inputModel = document.getElementById("model");
  let inputToggle = document.getElementById("toggle");

  if (inputQuery && inputStyle && inputModel && inputToggle) {

    var validSpecs = $3Dmol.extend({}, atomSpec);
    $3Dmol.extend(validSpecs, otherExtra);
    loadMolecule();

    function updateUrl(event) {
      event.preventDefault();

      const value = inputQuery.value;
      const style = inputStyle.value;
      const model = inputModel.value;

      const newUrl = `?id=${value.trim()}&style=${style}&model=${model}`;

      if (window.history && window.history.pushState) {
        window.history.pushState({}, "", newUrl);
      } else {
        window.location.href = newUrl;
      }
      loadMolecule();
    }

    function labelToggle() {
      inputToggle.addEventListener("change", (event) => {
        const atoms = glviewer.getModel().selectedAtoms();
        if (inputToggle.checked) {
          inputToggle.title = "Hide Labels";
          atoms.forEach((atom) => {
            const label = getAtomLabel(atom);
            atom._clickLabel = glviewer.addLabel(label, {
              position: atom,
              fontSize: 26,
              backgroundColor: "black",
              backgroundOpacity: 0.75,
              alignment: "bottomCenter",
            });
          });
        } else {
          inputToggle.title = "Show Labels";
          atoms.forEach((atom) => {
            glviewer.removeLabel(atom._clickLabel);
            atom._clickLabel = null;
          });
        }

        glviewer.render();
      });
    }

    function loadMolecule() {
      try {
        const queryString = window.location.search;

        if (queryString) {
          const paramsString = queryString.slice(1);

          const urlParams = new URLSearchParams(paramsString);

          var style = urlParams.get("style");
          var id = urlParams.get("id");
          var type = urlParams.get("model") || "sdf";
        }

        inputQuery.value = id;
        inputStyle.value = style || "stick";
        inputModel.value = type;

        if (glviewer === null) {
          glviewer = $3Dmol.createViewer("editor", {
            defaultcolors: $3Dmol.rasmolElementColors,
          });
          glviewer.setBackgroundColor(0xffffff);
        } else {
          glviewer.clear();
        }

        const url = getFetchUrl(type, id);

        if (type === "cid") {
          type = "sdf";
        }
        if (style === "cartoon") {
          style = { cartoon: { color: "spectrum" } };
        }

        $.get(url.replace('+',''), function (ret, txt, response) {
          glviewer.addModel(ret, type);
          processCommands(glviewer, style ? style : "stick");
          glviewer.zoomTo();
          glviewer.render();
        }).fail(function () {
          console.log("Failed to fetch " + url);
        });
      } catch (e) {
        console.log(e);
      }
    }
  }
});

function render() {
  glviewer.setStyle({}, { line: {} });
  processCommands(glviewer);
  glviewer.render();
}

function getAtomLabel(atom) {
  let label = atom.elem;
  if (atom.resn && atom.resi) {
    label = atom.resn + atom.resi + ":" + atom.atom;
  }
  return label;
}

function processCommands(viewer, style) {
  let hoverLabel = null;
  let lastClicked = null;

  viewer.setStyle({}, $3Dmol.specStringToObject(style || "stick"));

  // Hover atom label management
  viewer.setHoverable(
    {},
    true,
    function onHover(atom) {
      if (!atom._clickLabel) {
        const label = getAtomLabel(atom);
        hoverLabel = viewer.addLabel(label, {
          position: atom,
          fontSize: 26,
          backgroundColor: "black",
          backgroundOpacity: 0.75,
          alignment: "bottomCenter",
        });
        viewer.render();
      }
    },
    function onUnhover() {
      if (hoverLabel) {
        viewer.removeLabel(hoverLabel);
        hoverLabel = null;
        viewer.render();
      }
    }
  );

  viewer.setClickable({}, true, function onClick(atom) {
    if (hoverLabel) {
      viewer.removeLabel(hoverLabel);
      hoverLabel = null;
    }
    if (!lastClicked) {
      const label = getAtomLabel(atom);
      atom._clickLabel = viewer.addLabel(label, {
        position: atom,
        fontSize: 26,
        backgroundColor: "black",
        backgroundOpacity: 0.75,
        alignment: "bottomCenter",
      });
      lastClicked = atom;
    } else {
      viewer.removeLabel(lastClicked._clickLabel);
      lastClicked._clickLabel = null;

      if (lastClicked !== atom) {
        const start = new $3Dmol.Vector3(
          lastClicked.x,
          lastClicked.y,
          lastClicked.z
        );
        const end = new $3Dmol.Vector3(atom.x, atom.y, atom.z);
        let distanceLabel = null;

        viewer.addCylinder({
          dashed: true,
          radius: 0.05,
          dashLength: 0.25,
          gapLength: 0.15,
          start: start,
          end: end,
          fromCap: 2,
          toCap: 2,
          color: "red",
          clickable: true,
          callback: function onCylinderClick(shape) {
            viewer.removeShape(shape);
            viewer.removeLabel(distanceLabel);
          },
        });

        const distance = $3Dmol.GLShape.distance_from(start, end);
        const midPoint = start.add(end).multiplyScalar(0.5);
        distanceLabel = viewer.addLabel(distance.toFixed(3), {
          position: midPoint,
          fontSize: 16,
          backgroundColor: "red",
          backgroundOpacity: 0.75,
          alignment: "bottomCenter",
        });
      }
      lastClicked = null;
    }
    viewer.render();
  });
}

function getFetchUrl(type, value = 217) {
  const pubchemBaseUrl =
    "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/";
  const cactusBaseUrl = "https://cactus.nci.nih.gov/chemical/structure/";
  const mmtfBaseUrl = "https://mmtf.rcsb.org/v1.0/full/";
  const rcsbBaseUrl = "https://files.rcsb.org/view/";

  function constructUrl(src, value) {
    switch (src) {
      case "cid":
        return pubchemBaseUrl + value + "/SDF?record_type=3d";
      case "smiles":
        return cactusBaseUrl + encodeURIComponent(value) + "/file?format=sdf";
      case "mmtf":
        return mmtfBaseUrl + value;
      case "cif":
        return rcsbBaseUrl + value + ".cif";
      case "pdb":
        return rcsbBaseUrl + value + ".pdb";
      default:
        return pubchemBaseUrl + 217 + "/SDF?record_type=3d";
    }
  }

  return constructUrl(type, value.trim());
}
