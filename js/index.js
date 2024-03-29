var glviewer = null;

var render = function () {
  glviewer.setStyle({}, { line: {} });
  processCommands(glviewer);
  glviewer.render();
};

// Combine element, residue name and number (if available)
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

function loadMolecule() {
  try {
    const queryString = window.location.search;

    if (queryString) {
      const paramsString = queryString.slice(1);

      const urlParams = new URLSearchParams(paramsString);

      var style = urlParams.get("style");
      var cid = urlParams.get("cid") || 217;
    }

    document.getElementById("search").value = cid;
    document.getElementById("display").value = style;

    if (glviewer === null) {
      glviewer = $3Dmol.createViewer("editor", {
        defaultcolors: $3Dmol.rasmolElementColors,
      });
      glviewer.setBackgroundColor(0xffffff);
    } else {
      glviewer.clear();
    }

    var type = "sdf";
    var url =
      "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/" +
      cid +
      "/SDF?record_type=3d";

    $.get(url, function (ret, txt, response) {
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

function updateUrl() {
  event.preventDefault();

  const cid = document.getElementById("search").value;
  const style = document.getElementById("display").value;

  const newUrl = `?cid=${cid}&style=${style}`;

  if (window.history && window.history.pushState) {
    window.history.pushState({}, "", newUrl);
  } else {
    window.location.href = newUrl;
  }
  loadMolecule();
}

function labelToggle() {
  const toggle = document.getElementById("toggle");

  toggle.addEventListener("change", (event) => {
    const atoms = glviewer.getModel().selectedAtoms();
    if (toggle.checked) {
      toggle.title = "Hide Labels";
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
      toggle.title = "Show Labels";
      atoms.forEach((atom) => {
        glviewer.removeLabel(atom._clickLabel);
        atom._clickLabel = null;
      });
    }

    glviewer.render();
  });
}

$(document).ready(function () {
  var validSpecs = $3Dmol.extend({}, atomSpec);
  $3Dmol.extend(validSpecs, otherExtra);
  loadMolecule();
});
