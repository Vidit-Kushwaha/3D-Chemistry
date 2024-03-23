var glviewer = null;

var render = function () {
  glviewer.setStyle({}, { line: {} });
  processCommands(glviewer);
  glviewer.render();
};

function processCommands(viewer, style) {
  let hoverLabel = null;
  let lastClicked = null;


  viewer.setStyle({}, $3Dmol.specStringToObject(style || "stick"));

  // Combine element, residue name and number (if available)
  function getAtomLabel(atom) {
    let label = atom.elem;
    if (atom.resn && atom.resi) {
      label = atom.resn + atom.resi + ":" + atom.atom;
    }
    return label;
  }

  // Hover atom label management
  viewer.setHoverable(
    {},
    true,
    function onHover(atom) {
      if (!atom._clickLabel) {
        const label = getAtomLabel(atom);
        hoverLabel = viewer.addLabel(label, {
          position: atom,
          fontSize: 12,
          backgroundColor: "black",
          backgroundOpacity: 0.5,
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
        fontSize: 16,
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
    var url = window.location.search.substring(1);
    url = decodeURIComponent(url);
    var cmds = url.split("&");
    var first = cmds.splice(0, 1)[0];
    var pos = first.indexOf("=");
    var src = first.substring(0, pos),
      style = first.substring(pos + 1);

    if (glviewer === null) {
      glviewer = $3Dmol.createViewer("editor", {
        defaultcolors: $3Dmol.rasmolElementColors,
      });
      glviewer.setBackgroundColor(0xffffff);
    } else {
      glviewer.clear();
    }

    var data =  217;

    var type = "sdf";
    var url =
      "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/" +
      data +
      "/SDF?record_type=3d";

    $.get(url, function (ret, txt, response) {
      glviewer.addModel(ret, type);
      processCommands(glviewer, src =="style" ?style : "stick");
      glviewer.zoomTo();
      glviewer.render();
    }).fail(function () {
      console.log("Failed to fetch " + url);
    });
  } catch (e) {
    console.log(e);
  }
}

$(document).ready(function () {
  var validSpecs = $3Dmol.extend({}, atomSpec);
  $3Dmol.extend(validSpecs, otherExtra);
  loadMolecule();
});
